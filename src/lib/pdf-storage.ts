import { supabase } from "@/integrations/supabase/client";

/**
 * Optional entitlement check — does not persist files or block conversion on failure.
 * Processing is in-memory only; this only tracks free-tier usage when it succeeds.
 */
export async function consumeProcessingSlot(meta: {
  fileName?: string;
  fileSize?: number;
  tool?: string;
}): Promise<
  | { ok: true; allowed: boolean; remaining: number | null; subscribed: boolean }
  | { ok: false; error: string }
> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { ok: false, error: "no_session" };

  try {
    const res = await fetch("/api/pdf/consume", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meta),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      allowed?: boolean;
      remaining?: number | null;
      subscribed?: boolean;
      error?: string;
    };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return {
      ok: true,
      allowed: body.allowed === true,
      remaining: body.remaining ?? null,
      subscribed: body.subscribed === true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    return { ok: false, error: message };
  }
}
