import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmpseed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { email, password } = (await request.json()) as { email: string; password: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: "Verify Admin" },
        });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
        return Response.json({ ok: true, id: data.user?.id });
      },
    },
  },
});