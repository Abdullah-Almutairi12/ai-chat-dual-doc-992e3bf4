import { createFileRoute } from "@tanstack/react-router";

// Called daily by pg_cron. Charges saved cards for subscriptions whose period
// has ended, then fulfills any captured renewal (adds credits, extends period).
export const Route = createFileRoute("/api/public/tap-renew")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { chargeRenewal, fulfillCharge } = await import("@/lib/tap.server");

          const nowIso = new Date().toISOString();
          const { data: due } = await supabaseAdmin
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
              if (charge?.status === "CAPTURED" && charge?.id) {
                await fulfillCharge(charge.id);
                processed += 1;
              } else if (charge?.status === "DECLINED" || charge?.status === "FAILED") {
                await supabaseAdmin
                  .from("subscriptions")
                  .update({ status: "past_due" })
                  .eq("user_id", sub.user_id)
                  .eq("plan_id", sub.plan_id);
              }
            } catch (err) {
              console.error("[tap-renew] failed for", sub.user_id, sub.plan_id, err);
            }
          }

          return new Response(JSON.stringify({ ok: true, due: due?.length ?? 0, processed }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[tap-renew] error", err);
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});