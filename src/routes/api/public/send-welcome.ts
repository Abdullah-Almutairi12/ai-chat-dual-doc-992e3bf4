import { createFileRoute } from "@tanstack/react-router";

// Called by a database trigger (via pg_net) right after a new profile is created.
// Sends the branded welcome email through Resend. Secured with CRON_SECRET, and
// the recipient is always resolved server-side from the stored profile (never
// trusted from the request body) so it can only email real registered users.
export const Route = createFileRoute("/api/public/send-welcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-webhook-secret");
        if (!secret || secret !== process.env.CRON_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const body = (await request.json().catch(() => ({}))) as { user_id?: string };
          const userId = body?.user_id;
          if (!userId) {
            return new Response(JSON.stringify({ ok: false, reason: "no user_id" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email,name,welcome_sent")
            .eq("user_id", userId)
            .maybeSingle();

          if (!profile?.email || profile.welcome_sent) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          const { sendWelcomeEmail } = await import("@/lib/email.server");
          await sendWelcomeEmail(profile.email, profile.name ?? null);
          await supabaseAdmin
            .from("profiles")
            .update({ welcome_sent: true })
            .eq("user_id", userId);

          return new Response(JSON.stringify({ ok: true, sent: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[send-welcome] error", err);
          return new Response(JSON.stringify({ ok: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
