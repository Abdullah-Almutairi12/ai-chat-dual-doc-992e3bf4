import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaultFreeEntitlement,
  FREE_FILE_LIMIT,
  type EntitlementSnapshot,
} from "@/lib/entitlement.constants";

export { FREE_FILE_LIMIT } from "@/lib/entitlement.constants";
export type Entitlement = EntitlementSnapshot;

async function hasActiveSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    return !!data && data.length > 0;
  } catch {
    return false;
  }
}

function claimEmail(claims: unknown): string {
  if (!claims || typeof claims !== "object") return "";
  const bag = claims as { email?: string; user_email?: string };
  return typeof bag.email === "string" ? bag.email : typeof bag.user_email === "string" ? bag.user_email : "";
}

function claimName(claims: unknown): string | undefined {
  if (!claims || typeof claims !== "object") return undefined;
  const meta = (claims as { user_metadata?: { name?: string; full_name?: string } }).user_metadata;
  return meta?.name ?? meta?.full_name;
}

function buildEntitlement(
  filesProcessed: number,
  subscribed: boolean,
): EntitlementSnapshot {
  const remaining = subscribed ? null : Math.max(0, FREE_FILE_LIMIT - filesProcessed);
  const allowed = subscribed || filesProcessed < FREE_FILE_LIMIT;
  return { filesProcessed, freeLimit: FREE_FILE_LIMIT, subscribed, remaining, allowed };
}

/** Read the current user's free-trial entitlement (no side effects). */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementSnapshot> => {
    try {
      const { supabase, userId, claims } = context;
      const { ensureUserProfile, readFilesProcessed } = await import("@/lib/entitlement.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      await ensureUserProfile(supabaseAdmin, userId, {
        email: claimEmail(claims),
        name: claimName(claims),
      });

      const subscribed = await hasActiveSubscription(supabase, userId);
      const filesProcessed = await readFilesProcessed(supabase, userId);
      return buildEntitlement(filesProcessed, subscribed);
    } catch (err) {
      console.error("[getEntitlement]", err);
      return defaultFreeEntitlement();
    }
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
  .handler(async ({ context, data }): Promise<EntitlementSnapshot> => {
    try {
      const { supabase, userId, claims } = context;
      const email = claimEmail(claims);
      const { ensureUserProfile, readFilesProcessed } = await import("@/lib/entitlement.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      await ensureUserProfile(supabaseAdmin, userId, { email, name: claimName(claims) });

      const subscribed = await hasActiveSubscription(supabase, userId);
      let allowed = subscribed;

      if (!subscribed) {
        const { data: ok, error } = await supabaseAdmin.rpc("consume_free_file", {
          _user_id: userId,
          _limit: FREE_FILE_LIMIT,
        });
        if (error) {
          console.error("[consumeFile] rpc error", error.message);
          // Transient DB/RPC errors must not block client-side PDF processing.
          return defaultFreeEntitlement();
        }
        allowed = ok === true;
      }

      if (allowed) {
        await supabase.from("documents").insert({
          user_id: userId,
          user_email: email,
          file_name: data.fileName,
          file_size: data.fileSize,
          tool_used: data.tool,
        });
      }

      const filesProcessed = await readFilesProcessed(supabase, userId);
      return { ...buildEntitlement(filesProcessed, subscribed), allowed };
    } catch (err) {
      console.error("[consumeFile]", err);
      return defaultFreeEntitlement();
    }
  });
