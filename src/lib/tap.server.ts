// Server-only Tap Payments integration. Never import this from a route file or
// component; only from server function/route handlers (dynamic import).
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  isTapLiveMode as resolveTapLiveMode,
  readServerEnvAlias,
  SERVER_ENV_ALIASES,
} from "@/integrations/supabase/env";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BILLING_INTERVAL_DAYS, CURRENCY, getPlan, type Plan } from "./packages";

const TAP_BASE = "https://api.tap.company/v2";

function tapKey(): string {
  const key = readServerEnvAlias(SERVER_ENV_ALIASES.tapSecret);
  if (!key) throw new Error("TAP_SECRET_KEY is not configured");
  return key;
}

/**
 * True when a real Tap LIVE secret key is configured (sk_live_...).
 * In live mode we must never fall back to the simulated checkout, because that
 * would grant credits without a real payment.
 */
export function isTapLiveMode(): boolean {
  return resolveTapLiveMode();
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

function getTapWebhookUrl(): string {
  return (
    readServerEnvAlias(SERVER_ENV_ALIASES.tapWebhookUrl) ||
    `${readServerEnvAlias(SERVER_ENV_ALIASES.appOrigin) ?? "https://pdfquanta.online"}/api/public/tap-webhook`
  );
}

/** ISO decimal places for Tap hashstring amount formatting. */
const TAP_CURRENCY_DECIMALS: Record<string, number> = {
  SAR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  QAR: 2,
  EGP: 2,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
};

function formatTapAmount(amount: unknown, currency: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? "");
  const code = String(currency ?? CURRENCY).toUpperCase();
  const decimals = TAP_CURRENCY_DECIMALS[code] ?? 2;
  return n.toFixed(decimals);
}

type TapWebhookPayload = {
  id?: string;
  object?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  reference?: { gateway?: string; payment?: string };
  transaction?: { created?: string | number };
  updated?: string | number;
  created?: string | number;
};

/**
 * Validate Tap webhook authenticity via the hashstring header.
 * @see https://developers.tap.company/docs/webhook
 */
export function verifyTapWebhookHash(
  payload: TapWebhookPayload | Record<string, unknown>,
  hashHeader: string | null,
): boolean {
  const body = payload as TapWebhookPayload;
  if (!hashHeader?.trim()) return false;

  const id = String(body.id ?? "");
  const amount = formatTapAmount(body.amount, body.currency);
  const currency = String(body.currency ?? "");
  const gatewayReference = String(body.reference?.gateway ?? "");
  const paymentReference = String(body.reference?.payment ?? "");
  const status = String(body.status ?? "");

  const objectType = String(body.object ?? "charge");
  const isInvoice = objectType === "invoice";
  const updated = String(body.updated ?? "");
  const created = String(
    body.transaction?.created ?? body.created ?? "",
  );

  const toBeHashed = isInvoice
    ? `x_id${id}x_amount${amount}x_currency${currency}x_updated${updated}x_status${status}x_created${created}`
    : `x_id${id}x_amount${amount}x_currency${currency}x_gateway_reference${gatewayReference}x_payment_reference${paymentReference}x_status${status}x_created${created}`;

  const computed = createHmac("sha256", tapKey()).update(toBeHashed).digest("hex");
  const received = hashHeader.trim().toLowerCase();
  const expected = computed.toLowerCase();

  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

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
      description: `PDF Quanta — ${plan.nameEn} plan`,
      metadata: { user_id: userId, plan_id: plan.id, kind: "subscription" },
      receipt: { email: true, sms: false },
      customer: {
        first_name: email ? email.split("@")[0] : "Customer",
        email: email || undefined,
      },
      source: { id: "src_all" },
      redirect: { url: `${origin}/payment/callback` },
      post: { url: getTapWebhookUrl() },
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
 * Idempotently record a captured charge: transaction + credits + subscription.
 * The unique invoice_id guarantees credits are added exactly once per charge.
 */
async function fulfillFromMeta(args: {
  chargeId: string;
  userId: string;
  planId: string;
  email: string;
  amount: number;
  currency: string;
  kind: string;
  customerId?: string | null;
  cardId?: string | null;
}): Promise<FulfillResult> {
  const plan = getPlan(args.planId);
  if (!plan) return { status: "CAPTURED", fulfilled: false, planId: args.planId };

  const result: FulfillResult = {
    status: "CAPTURED",
    fulfilled: false,
    credits: plan.credits,
    planId: plan.id,
    planNameEn: plan.nameEn,
    planNameAr: plan.nameAr,
    amount: args.amount || plan.price,
    currency: args.currency || CURRENCY,
  };

  const { error: insErr } = await supabaseAdmin.from("transactions").insert({
    user_id: args.userId,
    invoice_id: args.chargeId,
    user_email: args.email || "unknown@pdfquanta.app",
    amount: args.amount || plan.price,
    currency: args.currency || CURRENCY,
    status: "succeeded",
    credits: plan.credits,
    plan_id: plan.id,
    kind: args.kind === "renewal" ? "renewal" : "purchase",
  });

  if (insErr) {
    // 23505 = already recorded → already fulfilled, do not double-credit.
    if ((insErr as { code?: string }).code === "23505") {
      return { ...result, fulfilled: false, already: true };
    }
    throw insErr;
  }

  await supabaseAdmin.rpc("add_credits", { _user_id: args.userId, _amount: plan.credits });

  const periodEnd = new Date(Date.now() + BILLING_INTERVAL_DAYS * 86_400_000).toISOString();
  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: args.userId,
      plan_id: plan.id,
      status: "active",
      amount: plan.price,
      currency: CURRENCY,
      credits_per_cycle: plan.credits,
      tap_customer_id: args.customerId ?? null,
      tap_card_id: args.cardId ?? null,
      last_charge_id: args.chargeId,
      current_period_end: periodEnd,
    },
    { onConflict: "user_id,plan_id" },
  );

  await supabaseAdmin.from("profiles").update({ tier: plan.id }).eq("user_id", args.userId);

  // Send the payment invoice/receipt via Resend. Never let email failure break
  // fulfillment — credits are already applied above.
  try {
    let email = args.email;
    if (!email || !email.includes("@") || email === "unknown@pdfquanta.app") {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email,name")
        .eq("user_id", args.userId)
        .maybeSingle();
      email = prof?.email || email;
    }
    if (email && email.includes("@")) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("user_id", args.userId)
        .maybeSingle();
      const { sendInvoiceEmail } = await import("./email.server");
      await sendInvoiceEmail({
        to: email,
        name: prof?.name ?? null,
        planNameEn: plan.nameEn,
        planNameAr: plan.nameAr,
        amount: args.amount || plan.price,
        currency: args.currency || CURRENCY,
        credits: plan.credits,
        invoiceId: args.chargeId,
        kind: args.kind,
      });
    }
  } catch (err) {
    console.error("[fulfillFromMeta] invoice email failed:", err);
  }

  return { ...result, fulfilled: true };
}

export type FulfillOptions = {
  /** When set (browser callback), the charge must belong to this user. */
  expectedUserId?: string;
};

/**
 * Verify + fulfill a charge. Handles both real Tap charges and the built-in
 * simulated ("mock_") charges. Safe to call from the webhook and the callback.
 */
export async function fulfillCharge(
  chargeId: string,
  opts: FulfillOptions = {},
): Promise<FulfillResult> {
  // Simulated checkout: credits are applied at confirmation time; here we just
  // report the outcome based on the stored intent.
  if (chargeId.startsWith("mock_")) {
    if (!opts.expectedUserId) {
      throw new Error("Authentication required");
    }
    const { data: intent } = await supabaseAdmin
      .from("payment_intents")
      .select("user_id,plan_id,status,amount,currency")
      .eq("id", chargeId)
      .maybeSingle();
    const plan = intent ? getPlan(intent.plan_id) : undefined;
    if (!intent || intent.user_id !== opts.expectedUserId || !plan || intent.status !== "captured") {
      throw new Error("Charge not found");
    }
    return {
      status: "CAPTURED",
      fulfilled: false,
      already: true,
      credits: plan.credits,
      planId: plan.id,
      planNameEn: plan.nameEn,
      planNameAr: plan.nameAr,
      amount: Number(intent.amount),
      currency: intent.currency ?? CURRENCY,
    };
  }

  const charge = await retrieveCharge(chargeId);
  const status: string = charge?.status ?? "UNKNOWN";
  const meta = charge?.metadata ?? {};
  const userId: string | undefined = meta.user_id;
  const planId: string | undefined = meta.plan_id;

  if (opts.expectedUserId && userId !== opts.expectedUserId) {
    throw new Error("Charge not found");
  }

  if (status !== "CAPTURED" || !userId || !planId) {
    return { status, fulfilled: false, planId };
  }

  const email = charge?.customer?.email ?? "unknown@pdfquanta.app";
  return fulfillFromMeta({
    chargeId,
    userId,
    planId,
    email: typeof email === "string" ? email : "unknown@pdfquanta.app",
    amount: Number(charge.amount),
    currency: charge.currency ?? CURRENCY,
    kind: meta.kind === "renewal" ? "renewal" : "purchase",
    customerId: charge?.customer?.id ?? null,
    cardId: charge?.card?.id ?? null,
  });
}

/** Create a simulated checkout intent and return the internal mock-pay URL. */
export async function createMockCharge(opts: {
  userId: string;
  plan: Plan;
  origin: string;
}): Promise<{ url: string; chargeId: string }> {
  const chargeId = `mock_${crypto.randomUUID()}`;
  const { error } = await supabaseAdmin.from("payment_intents").insert({
    id: chargeId,
    user_id: opts.userId,
    plan_id: opts.plan.id,
    amount: opts.plan.price,
    currency: CURRENCY,
    status: "pending",
  });
  if (error) throw error;
  return { url: `${opts.origin}/payment/mock?cid=${chargeId}`, chargeId };
}

/** Confirm a simulated payment for the owning user and apply credits. */
export async function confirmMockPayment(
  userId: string,
  email: string,
  chargeId: string,
): Promise<FulfillResult> {
  if (!chargeId.startsWith("mock_")) throw new Error("Invalid simulated charge");
  const { data: intent } = await supabaseAdmin
    .from("payment_intents")
    .select("user_id,plan_id,amount,currency,status")
    .eq("id", chargeId)
    .maybeSingle();
  if (!intent || intent.user_id !== userId) throw new Error("Charge not found");

  await supabaseAdmin.from("payment_intents").update({ status: "captured" }).eq("id", chargeId);

  return fulfillFromMeta({
    chargeId,
    userId,
    planId: intent.plan_id,
    email,
    amount: Number(intent.amount),
    currency: intent.currency ?? CURRENCY,
    kind: "purchase",
  });
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
      redirect: { url: getTapWebhookUrl() },
      post: { url: getTapWebhookUrl() },
    }),
  });
  return charge;
}