import { timingSafeEqual } from "node:crypto";

import { readServerEnv } from "@/integrations/supabase/env";

/** Verify server-to-server cron / internal webhook calls (pg_net, pg_cron). */
export function verifyCronSecret(request: Request): boolean {
  const expected = readServerEnv("CRON_SECRET");
  if (!expected) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return false;
  }

  const provided = request.headers.get("x-webhook-secret")?.trim();
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
