/** Verify server-to-server cron / internal webhook calls (pg_net, pg_cron). */
export function verifyCronSecret(request: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET")?.trim();
  if (!expected) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return false;
  }

  const provided = request.headers.get("x-webhook-secret")?.trim();
  if (!provided) return false;
  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
