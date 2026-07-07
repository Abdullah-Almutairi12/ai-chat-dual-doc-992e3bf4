import { verifyCronSecret } from "../_shared/cron.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { chargeRenewal, fulfillCharge } from "../_shared/tap.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data: due } = await admin
      .from("subscriptions")
      .select("user_id,plan_id,amount,tap_customer_id,tap_card_id")
      .eq("status", "active")
      .lte("current_period_end", nowIso)
      .not("tap_card_id", "is", null)
      .limit(100);

    let processed = 0;
    for (const sub of due ?? []) {
      try {
        const charge = await chargeRenewal(sub);
        const status = String(charge.status ?? "");
        const chargeId = typeof charge.id === "string" ? charge.id : null;

        if (status === "CAPTURED" && chargeId) {
          await fulfillCharge(chargeId);
          processed += 1;
        } else if (status === "DECLINED" || status === "FAILED") {
          await admin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("user_id", sub.user_id)
            .eq("plan_id", sub.plan_id);
        }
      } catch (err) {
        console.error("[tap-renew] failed for", sub.user_id, sub.plan_id, err);
      }
    }

    return json({ ok: true, due: due?.length ?? 0, processed });
  } catch (err) {
    console.error("[tap-renew] error", err);
    return json({ ok: false }, 500);
  }
});
