// Server-only Tap Payments integration. Never import this from a route file or
// component; only from server function/route handlers (dynamic import).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BILLING_INTERVAL_DAYS, CURRENCY, getPlan, type Plan } from "./packages";

const TAP_BASE = "https://api.tap.company/v2";

function tapKey(): string {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) throw new Error("TAP_SECRET_KEY is not configured");
  return key;
}

async function tapFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${TAP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tapKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body && (body.errors?.[0]?.description || body.message)) ||
      `Tap request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as Record<string, any>;
}

const WEBHOOK_URL =
  "https://project--b4f885d5-2337-435a-8cce-f1c4b9bf02fd.lovable.app/api/public/tap-webhook";

/** Create a hosted checkout charge and return the redirect URL. */
export async function createTapCharge(opts: {
  userId: string;
  email: string;
  plan: Plan;
  origin: string;
}): Promise<{ url: string; chargeId: string }> {
  const { userId, email, plan, origin } = opts;
  const charge = await tapFetch("/charges", {
    method: "POST",
    body: JSON.stringify({
      amount: plan.price,
      currency: CURRENCY,
      threeDSecure: true,
      save_card: true,
      description: `PDF Quanta — ${plan.nameEn} plan`,
      metadata: { user_id: userId, plan_id: plan.id, kind: "subscription" },
      receipt: { email: true, sms: false },
      customer: {
        first_name: email ? email.split("@")[0] : "Customer",
        email: email || undefined,
      },
      source: { id: "src_all" },
      redirect: { url: `${origin}/payment/callback` },
      post: { url: WEBHOOK_URL },
    }),
  });
  const url = charge?.transaction?.url;
  if (!url) throw new Error("Tap did not return a checkout URL");
  return { url, chargeId: charge.id };
}

/** Retrieve a charge (source of truth for status). */
export async function retrieveCharge(chargeId: string) {
  return tapFetch(`/charges/${chargeId}`, { method: "GET" });
}

export type FulfillResult = {
  status: string;
  fulfilled: boolean;
  already?: boolean;
  credits?: number;
  planId?: string;
  planNameEn?: string;
  planNameAr?: string;
  amount?: number;
  currency?: string;
};

/**
 * Idempotently fulfill a captured charge: record the transaction, add credits,
 * and upsert the subscription. Safe to call from both the webhook and the
 * client callback — the unique invoice_id guarantees credits are added once.
 */
export async function fulfillCharge(chargeId: string): Promise<FulfillResult> {
  const charge = await retrieveCharge(chargeId);
  const status: string = charge?.status ?? "UNKNOWN";
  const meta = charge?.metadata ?? {};
  const userId: string | undefined = meta.user_id;
  const planId: string | undefined = meta.plan_id;
  const plan = planId ? getPlan(planId) : undefined;

  if (status !== "CAPTURED" || !userId || !plan) {
    return { status, fulfilled: false, planId };
  }

  const result: FulfillResult = {
    status,
    fulfilled: false,
    credits: plan.credits,
    planId: plan.id,
    planNameEn: plan.nameEn,
    planNameAr: plan.nameAr,
    amount: Number(charge.amount),
    currency: charge.currency ?? CURRENCY,
  };

  const email = charge?.customer?.email ?? charge?.receipt?.email ?? "unknown@pdfquanta.app";

  const { error: insErr } = await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    invoice_id: chargeId,
    user_email: typeof email === "string" ? email : "unknown@pdfquanta.app",
    amount: Number(charge.amount) || plan.price,
    currency: charge.currency ?? CURRENCY,
    status: "succeeded",
    credits: plan.credits,
    plan_id: plan.id,
    kind: meta.kind === "renewal" ? "renewal" : "purchase",
  });

  if (insErr) {
    // 23505 = already recorded → already fulfilled, do not double-credit.
    if ((insErr as any).code === "23505") {
      return { ...result, fulfilled: false, already: true };
    }
    throw insErr;
  }

  await supabaseAdmin.rpc("add_credits", { _user_id: userId, _amount: plan.credits });

  const periodEnd = new Date(Date.now() + BILLING_INTERVAL_DAYS * 86_400_000).toISOString();
  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: plan.id,
      status: "active",
      amount: plan.price,
      currency: CURRENCY,
      credits_per_cycle: plan.credits,
      tap_customer_id: charge?.customer?.id ?? null,
      tap_card_id: charge?.card?.id ?? null,
      last_charge_id: chargeId,
      current_period_end: periodEnd,
    },
    { onConflict: "user_id,plan_id" },
  );

  await supabaseAdmin.from("profiles").update({ tier: plan.id }).eq("user_id", userId);

  return { ...result, fulfilled: true };
}

/** Grant the free plan credits once per user. */
export async function claimFreePlan(userId: string, email: string) {
  const plan = getPlan("free")!;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("free_claimed")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.free_claimed) {
    return { claimed: false, alreadyClaimed: true, credits: 0 };
  }

  await supabaseAdmin.rpc("add_credits", { _user_id: userId, _amount: plan.credits });
  await supabaseAdmin.from("profiles").update({ free_claimed: true }).eq("user_id", userId);
  await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    invoice_id: `free-${userId}`,
    user_email: email || "unknown@pdfquanta.app",
    amount: 0,
    currency: CURRENCY,
    status: "succeeded",
    credits: plan.credits,
    plan_id: "free",
    kind: "free",
  });

  return { claimed: true, alreadyClaimed: false, credits: plan.credits };
}

/** Charge a saved card for a subscription renewal (merchant-initiated). */
export async function chargeRenewal(sub: {
  user_id: string;
  plan_id: string;
  amount: number;
  tap_customer_id: string | null;
  tap_card_id: string | null;
}) {
  if (!sub.tap_customer_id || !sub.tap_card_id) {
    throw new Error("Missing saved-card details for renewal");
  }
  const charge = await tapFetch("/charges", {
    method: "POST",
    body: JSON.stringify({
      amount: sub.amount,
      currency: CURRENCY,
      threeDSecure: false,
      description: `PDF Quanta — ${sub.plan_id} plan renewal`,
      metadata: { user_id: sub.user_id, plan_id: sub.plan_id, kind: "renewal" },
      customer: { id: sub.tap_customer_id },
      source: { id: sub.tap_card_id },
      redirect: { url: WEBHOOK_URL },
      post: { url: WEBHOOK_URL },
    }),
  });
  return charge;
}