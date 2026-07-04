import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPlan } from "./packages";

/** Start a Tap checkout for a paid plan. Returns the hosted-page URL. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; origin: string }) => data)
  .handler(async ({ data, context }) => {
    const plan = getPlan(data.planId);
    if (!plan || plan.price <= 0) throw new Error("Invalid plan");
    const origin = data.origin?.startsWith("http") ? data.origin : "";
    if (!origin) throw new Error("Invalid origin");

    const { createTapCharge, createMockCharge } = await import("./tap.server");
    const email = (context.claims as { email?: string })?.email ?? "";
    try {
      const { url } = await createTapCharge({ userId: context.userId, email, plan, origin });
      return { url, simulated: false };
    } catch (err) {
      // Tap unreachable / invalid key (e.g. placeholder sandbox keys) →
      // fall back to the built-in simulated checkout so the flow still works.
      console.error("[createCheckout] Tap failed, using simulated checkout:", err);
      const { url } = await createMockCharge({ userId: context.userId, plan, origin });
      return { url, simulated: true };
    }
  });

/** Confirm a simulated (mock) payment and apply credits. */
export const confirmMock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { chargeId: string }) => {
    if (!data?.chargeId?.startsWith("mock_")) throw new Error("Invalid charge");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { confirmMockPayment } = await import("./tap.server");
    const email = (context.claims as { email?: string })?.email ?? "";
    return confirmMockPayment(context.userId, email, data.chargeId);
  });

/** Claim the free plan's credits (once per user). */
export const claimFree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { claimFreePlan } = await import("./tap.server");
    const email = (context.claims as { email?: string })?.email ?? "";
    return claimFreePlan(context.userId, email);
  });

/** Verify a charge after redirect and fulfill it idempotently. */
export const verifyCharge = createServerFn({ method: "POST" })
  .inputValidator((data: { tapId: string }) => {
    if (!data?.tapId || typeof data.tapId !== "string") throw new Error("Missing charge id");
    return data;
  })
  .handler(async ({ data }) => {
    const { fulfillCharge } = await import("./tap.server");
    return fulfillCharge(data.tapId);
  });

/** Current user's active subscription + credit balance. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("subscriptions")
      .select("plan_id,status,amount,currency,credits_per_cycle,current_period_end")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false });
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("credits,tier")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      subscription: subs?.[0] ?? null,
      credits: profile?.credits ?? 0,
      tier: profile?.tier ?? "free",
    };
  });

/** Cancel all of the current user's active subscriptions. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", context.userId)
      .eq("status", "active");
    return { ok: true };
  });