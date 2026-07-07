import { BILLING_INTERVAL_DAYS, CURRENCY, getPlan } from "./packages.ts";
import { supabaseAdmin } from "./supabase.ts";

const TAP_BASE = "https://api.tap.company/v2";

function tapSecretKey(): string {
  const raw = Deno.env.get("TAP_SECRET_KEY")?.trim() ?? "";
  const key = raw.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  if (!/^sk_(test|live)_/.test(key)) {
    throw new Error("TAP_SECRET_KEY is not configured or invalid");
  }
  return key;
}

function getTapWebhookUrl(): string {
  return (
    Deno.env.get("TAP_WEBHOOK_URL")?.trim() ||
    `${Deno.env.get("APP_ORIGIN")?.replace(/\/$/, "") ?? "https://pdfquanta.online"}/api/public/tap-webhook`
  );
}

function isValidSavedCardSource(id: string | null | undefined): id is string {
  if (!id?.trim()) return false;
  const value = id.trim();
  return value.startsWith("card_") || value.startsWith("tok_") || value.startsWith("src_");
}

async function tapFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tapSecretKey()}`);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${TAP_BASE}${path}`, { ...init, method: init.method ?? "GET", headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const tapMsg =
      (body as { errors?: { description?: string }[]; message?: string }).errors?.[0]?.description ||
      (body as { message?: string }).message ||
      `Tap request failed (${res.status})`;
    throw new Error(tapMsg);
  }
  return body as Record<string, unknown>;
}

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
}) {
  const admin = supabaseAdmin();
  const plan = getPlan(args.planId);
  if (!plan) return { fulfilled: false as const, planId: args.planId };

  const { error: insErr } = await admin.from("transactions").insert({
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
    if ((insErr as { code?: string }).code === "23505") {
      return { fulfilled: false as const, already: true, planId: plan.id };
    }
    throw insErr;
  }

  await admin.rpc("add_credits", { _user_id: args.userId, _amount: plan.credits });

  const periodEnd = new Date(Date.now() + BILLING_INTERVAL_DAYS * 86_400_000).toISOString();
  await admin.from("subscriptions").upsert(
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

  await admin.from("profiles").update({ tier: plan.id }).eq("user_id", args.userId);
  return { fulfilled: true as const, planId: plan.id };
}

export async function chargeRenewal(sub: {
  user_id: string;
  plan_id: string;
  amount: number;
  tap_customer_id: string | null;
  tap_card_id: string | null;
}) {
  if (!sub.tap_customer_id?.trim()) throw new Error("Missing Tap customer id for renewal");
  if (!isValidSavedCardSource(sub.tap_card_id)) {
    throw new Error("Missing or invalid saved card source for renewal");
  }

  return tapFetch("/charges", {
    method: "POST",
    body: JSON.stringify({
      amount: sub.amount,
      currency: CURRENCY,
      customer_initiated: false,
      threeDSecure: false,
      description: `PDF Quanta — ${sub.plan_id} plan renewal`,
      metadata: { user_id: sub.user_id, plan_id: sub.plan_id, kind: "renewal" },
      customer: { id: sub.tap_customer_id.trim() },
      source: { id: sub.tap_card_id!.trim() },
      redirect: { url: getTapWebhookUrl() },
      post: { url: getTapWebhookUrl() },
    }),
  });
}

export async function fulfillCharge(chargeId: string) {
  const charge = await tapFetch(`/charges/${encodeURIComponent(chargeId.trim())}`, { method: "GET" });
  const status = String(charge.status ?? "UNKNOWN");
  const meta = (charge.metadata ?? {}) as Record<string, string>;
  const userId = meta.user_id;
  const planId = meta.plan_id;

  if (status !== "CAPTURED" || !userId || !planId) {
    return { status, fulfilled: false, planId };
  }

  const customer = charge.customer as { email?: string; id?: string } | undefined;
  const card = charge.card as { id?: string } | undefined;
  const email = typeof customer?.email === "string" ? customer.email : "unknown@pdfquanta.app";

  return fulfillFromMeta({
    chargeId,
    userId,
    planId,
    email,
    amount: Number(charge.amount),
    currency: String(charge.currency ?? CURRENCY),
    kind: meta.kind === "renewal" ? "renewal" : "purchase",
    customerId: customer?.id ?? null,
    cardId: card?.id ?? null,
  });
}
