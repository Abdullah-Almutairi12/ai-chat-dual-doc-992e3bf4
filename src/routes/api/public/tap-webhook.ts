import { createFileRoute } from "@tanstack/react-router";

// Tap Payments posts charge events here. We never trust the body's status —
// we re-fetch the charge from Tap (source of truth) inside fulfillCharge.
export const Route = createFileRoute("/api/public/tap-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
        const raw = await request.text();
        let payload: Record<string, any> = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            payload = {};
          }
          const chargeId: string | undefined =
            payload?.id || payload?.charge?.id || payload?.data?.id;

          if (!chargeId) {
            return new Response(JSON.stringify({ ok: false, reason: "no charge id" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          const { fulfillCharge } = await import("@/lib/tap.server");
          const result = await fulfillCharge(chargeId);
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[tap-webhook] error", err);
          // Return 200 so Tap does not hammer retries on our internal errors.
          return new Response(JSON.stringify({ ok: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});