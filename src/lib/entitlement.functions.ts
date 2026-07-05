import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Number of PDFs a brand-new user may process completely for free. */
export const FREE_FILE_LIMIT = 1;

type Entitlement = {
  filesProcessed: number;
  freeLimit: number;
  /** true when the user has an active paid subscription (unlimited). */
  subscribed: boolean;
  /** free tries left (null when subscribed = unlimited). */
  remaining: number | null;
  /** whether the user may process another file right now. */
  allowed: boolean;
};

async function hasActiveSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  return !!data && data.length > 0;
}

/** Read the current user's free-trial entitlement (no side effects). */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement> => {
    const { supabase, userId } = context;
    const subscribed = await hasActiveSubscription(supabase, userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("files_processed")
      .eq("user_id", userId)
      .maybeSingle();

    const filesProcessed = profile?.files_processed ?? 0;
    const remaining = subscribed ? null : Math.max(0, FREE_FILE_LIMIT - filesProcessed);
    const allowed = subscribed || filesProcessed < FREE_FILE_LIMIT;

    return { filesProcessed, freeLimit: FREE_FILE_LIMIT, subscribed, remaining, allowed };
  });

/**
 * Atomically consume one processing slot for the current user.
 * Subscribers are always allowed (no free credit is spent). Free users spend
 * one of their free files; the DB function guarantees they can never exceed
 * the limit even with concurrent uploads.
 */
export const consumeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileName?: string; fileSize?: number; tool?: string }) => ({
    fileName: (data?.fileName ?? "document").slice(0, 300),
    fileSize: Number.isFinite(data?.fileSize) ? Math.max(0, Math.floor(data!.fileSize!)) : 0,
    tool: (data?.tool ?? "chat").slice(0, 40),
  }))
  .handler(async ({ context, data }): Promise<Entitlement> => {
    const { supabase, userId } = context;
    const email = (context.claims as { email?: string })?.email ?? "";
    const subscribed = await hasActiveSubscription(supabase, userId);

    let allowed = subscribed;
    if (!subscribed) {
      const { data: ok, error } = await supabase.rpc("consume_free_file", {
        _user_id: userId,
        _limit: FREE_FILE_LIMIT,
      });
      if (error) throw new Error(error.message);
      allowed = ok === true;
    }

    // Record the processed file for history/analytics (best-effort).
    if (allowed) {
      await supabase.from("documents").insert({
        user_id: userId,
        user_email: email,
        file_name: data.fileName,
        file_size: data.fileSize,
        tool_used: data.tool,
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("files_processed")
      .eq("user_id", userId)
      .maybeSingle();

    const filesProcessed = profile?.files_processed ?? 0;
    const remaining = subscribed ? null : Math.max(0, FREE_FILE_LIMIT - filesProcessed);

    return { filesProcessed, freeLimit: FREE_FILE_LIMIT, subscribed, remaining, allowed };
  });
