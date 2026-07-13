import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  configErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  ApiConfigError,
} from "@/lib/api-auth.server";
import { loadPdfPipelineContext, extractVisionChunk } from "@/lib/pdf/vision/pipeline.server";
import { VisionNotConfiguredError } from "@/lib/pdf/vision/pipeline.server";
import { isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";
import { isPdfBytes, MASTER_SERVER_PROCESS_LIMIT_BYTES } from "@/lib/pdf/vision/upload-limits";

type ChunkBody = {
  storageBucket?: string;
  storagePath?: string;
  tool?: string;
  pageStart?: number;
  pageEnd?: number;
};

/**
 * POST /api/pdf/convert-chunk
 * JSON: { storageBucket, storagePath, tool, pageStart, pageEnd }
 * Processes 1–3 pages per request — prevents Vercel timeout and 8% freeze.
 */
export const Route = createFileRoute("/api/pdf/convert-chunk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabase, userId } = await authenticateRequest(request);
          const body = (await request.json().catch(() => ({}))) as ChunkBody;

          const toolRaw = String(body.tool ?? "").trim();
          if (!isMasterPdfTool(toolRaw)) {
            return jsonResponse({ ok: false, error: "Invalid tool" }, 400);
          }
          const tool = toolRaw as MasterConvertTool;

          const storageBucket = String(body.storageBucket ?? "").trim();
          const storagePath = String(body.storagePath ?? "").trim();
          if (!storageBucket || !storagePath) {
            return jsonResponse({ ok: false, error: "storageBucket and storagePath required" }, 400);
          }
          if (!storagePath.startsWith(`${userId}/`)) {
            return jsonResponse({ ok: false, error: "Invalid storage path" }, 403);
          }

          const pageStart = Math.max(1, Number(body.pageStart) || 1);
          const pageEnd = Math.max(pageStart, Number(body.pageEnd) || pageStart);

          const { data, error } = await supabase.storage.from(storageBucket).download(storagePath);
          if (error || !data) {
            return jsonResponse({ ok: false, error: error?.message ?? "Storage download failed" }, 404);
          }

          const pdfBytes = new Uint8Array(await data.arrayBuffer());
          if (pdfBytes.byteLength > MASTER_SERVER_PROCESS_LIMIT_BYTES) {
            return jsonResponse({ ok: false, error: "File exceeds 20MB limit" }, 413);
          }
          if (!isPdfBytes(pdfBytes)) {
            return jsonResponse({ ok: false, error: "Invalid PDF" }, 400);
          }

          const ctx = await loadPdfPipelineContext(pdfBytes);
          const chunk = await extractVisionChunk(ctx, tool, pageStart, pageEnd);

          return jsonResponse({
            ok: true,
            pages: chunk.pages,
            renders: chunk.renders,
            totalPages: chunk.totalPages,
            pageCount: chunk.pageCount,
            provider: chunk.meta.provider,
            model: chunk.meta.model,
          });
        } catch (err) {
          if (err instanceof ApiConfigError) return configErrorResponse(err);
          if (err instanceof Error && err.message === "Unauthorized") return unauthorizedResponse();
          if (err instanceof VisionNotConfiguredError) {
            return jsonResponse({ ok: false, error: "Vision AI not configured", code: "VISION_NOT_CONFIGURED" }, 503);
          }
          console.error("[api/pdf/convert-chunk]", err);
          return jsonResponse(
            { ok: false, error: err instanceof Error ? err.message : "Chunk extraction failed" },
            500,
          );
        }
      },
    },
  },
});
