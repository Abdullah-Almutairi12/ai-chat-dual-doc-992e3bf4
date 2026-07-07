import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  jsonResponse,
  unauthorizedResponse,
} from "@/lib/api-auth.server";
import {
  buildStorageObjectPath,
  bucketForPdfTool,
  STORAGE_BUCKETS,
  type StorageBucketId,
} from "@/integrations/supabase/storage-buckets";

const ALLOWED_BUCKETS = new Set<string>(Object.values(STORAGE_BUCKETS));

/**
 * POST /api/pdf/upload
 * Multipart: file (required), bucket (files|documents|pdf-tools), toolId (optional)
 * Stores under `{userId}/{timestamp}-{filename}` in the requested bucket.
 */
export const Route = createFileRoute("/api/pdf/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabase, userId } = await authenticateRequest(request);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) {
            return jsonResponse({ ok: false, error: "No file provided" }, 400);
          }

          const bucketRaw = String(form.get("bucket") ?? "").trim();
          const toolId = String(form.get("toolId") ?? "").trim();
          let bucket: StorageBucketId = STORAGE_BUCKETS.files;
          if (bucketRaw && ALLOWED_BUCKETS.has(bucketRaw)) {
            bucket = bucketRaw as StorageBucketId;
          } else if (toolId) {
            bucket = bucketForPdfTool(toolId);
          }

          const objectPath = buildStorageObjectPath(userId, file.name);
          const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
          if (error) {
            console.error("[api/pdf/upload]", bucket, error.message);
            return jsonResponse({ ok: false, error: error.message }, 500);
          }

          return jsonResponse({
            ok: true,
            bucket,
            path: objectPath,
            fileName: file.name,
            size: file.size,
          });
        } catch (err) {
          if (err instanceof Error && err.message === "Unauthorized") {
            return unauthorizedResponse();
          }
          console.error("[api/pdf/upload]", err);
          return jsonResponse({ ok: false, error: "Upload failed" }, 500);
        }
      },
    },
  },
});
