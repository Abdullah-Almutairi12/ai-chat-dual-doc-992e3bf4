import { createFileRoute } from "@tanstack/react-router";

// Tap Payments posts charge events here. Signature is verified via hashstring
// before we re-fetch the charge from Tap (source of truth) inside fulfillCharge.
export const Route = createFileRoute("/api/public/tap-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          let payload: Record<string, unknown> = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            return new Response(JSON.stringify({ ok: false, reason: "invalid json" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }

          const { verifyTapWebhookHash, fulfillCharge } = await import("@/lib/tap.server");
          const hashHeader = request.headers.get("hashstring");
          if (!verifyTapWebhookHash(payload, hashHeader)) {
            console.error("[tap-webhook] invalid hashstring");
            return new Response(JSON.stringify({ ok: false, reason: "invalid signature" }), {
              status: 403,
              headers: { "content-type": "application/json" },
            });
          }

          const chargeId: string | undefined =
            (payload.id as string | undefined) ||
            (payload.charge as { id?: string } | undefined)?.id ||
            (payload.data as { id?: string } | undefined)?.id;

          if (!chargeId) {
            return new Response(JSON.stringify({ ok: false, reason: "no charge id" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          const result = await fulfillCharge(chargeId);
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[tap-webhook] error", err);
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
