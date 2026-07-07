import { verifyCronSecret } from "../_shared/cron.ts";
import { sendWelcomeEmail } from "../_shared/email.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

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
    const body = (await req.json().catch(() => ({}))) as { user_id?: string };
    const userId = body?.user_id;
    if (!userId) {
      return json({ ok: false, reason: "no user_id" });
    }

    const admin = supabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("email,name,welcome_sent")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.email || profile.welcome_sent) {
      return json({ ok: true, skipped: true });
    }

    await sendWelcomeEmail(profile.email, profile.name ?? null);
    await admin.from("profiles").update({ welcome_sent: true }).eq("user_id", userId);

    return json({ ok: true, sent: true });
  } catch (err) {
    console.error("[send-welcome] error", err);
    return json({ ok: false });
  }
});
