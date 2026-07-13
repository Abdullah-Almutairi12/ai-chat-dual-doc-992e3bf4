import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  configErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  ApiConfigError,
} from "@/lib/api-auth.server";
import { FREE_FILE_LIMIT } from "@/lib/entitlement.constants";
import { ensureUserProfile, readFilesProcessed } from "@/lib/entitlement.server";

async function hasActiveSubscription(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
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

/**
 * POST /api/pdf/consume
 * JSON: { fileName, fileSize, tool }
 * Reserves one processing slot and logs to the documents table.
 */
export const Route = createFileRoute("/api/pdf/consume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabase, userId, email } = await authenticateRequest(request);
          const body = (await request.json().catch(() => ({}))) as {
            fileName?: string;
            fileSize?: number;
            tool?: string;
          };

          const fileName = (body.fileName ?? "document").slice(0, 300);
          const fileSize = Number.isFinite(body.fileSize) ? Math.max(0, Math.floor(body.fileSize!)) : 0;
          const tool = (body.tool ?? "pdf-tool").slice(0, 40);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          try {
            await ensureUserProfile(supabaseAdmin, userId, { email });
          } catch (profileErr) {
            console.error("[api/pdf/consume] profile ensure failed", profileErr);
          }

          const subscribed = await hasActiveSubscription(supabase, userId);
          let allowed = subscribed;

          if (!subscribed) {
            const { data: ok, error } = await supabaseAdmin.rpc("consume_free_file", {
              _user_id: userId,
              _limit: FREE_FILE_LIMIT,
            });
            if (error) {
              console.error("[api/pdf/consume] rpc error", error.message);
              const filesProcessed = await readFilesProcessed(supabase, userId);
              allowed = filesProcessed < FREE_FILE_LIMIT;
            } else {
              allowed = ok === true;
            }
          }

          if (allowed) {
            await supabase.from("documents").insert({
              user_id: userId,
              user_email: email,
              file_name: fileName,
              file_size: fileSize,
              tool_used: tool,
            });
          }

          const filesProcessed = await readFilesProcessed(supabase, userId);
          const remaining = subscribed ? null : Math.max(0, FREE_FILE_LIMIT - filesProcessed);

          return jsonResponse({
            ok: true,
            allowed,
            filesProcessed,
            freeLimit: FREE_FILE_LIMIT,
            subscribed,
            remaining,
          });
        } catch (err) {
          if (err instanceof ApiConfigError) {
            return configErrorResponse(err);
          }
          if (err instanceof Error && err.message === "Unauthorized") {
            return unauthorizedResponse();
          }
          console.error("[api/pdf/consume]", err);
          return jsonResponse({ ok: false, error: "Consume failed" }, 500);
        }
      },
    },
  },
});
