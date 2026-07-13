import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  configErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  ApiConfigError,
} from "@/lib/api-auth.server";
import { loadPdfPipelineContext, extractVisionChunk } from "@/lib/pdf/vision/pipeline.server";
import { VisionNotConfiguredError } from "@/lib/pdf/vision/convert.server";
import { isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";
import { isPdfBytes, MASTER_SERVER_PROCESS_LIMIT_BYTES } from "@/lib/pdf/vision/upload-limits";

type ChunkBody = {
  pdfBase64?: string;
  tool?: string;
  pageStart?: number;
  pageEnd?: number;
};

/**
 * POST /api/pdf/convert-chunk
 * JSON: { pdfBase64, tool, pageStart, pageEnd } — in-memory only, no storage.
 */
export const Route = createFileRoute("/api/pdf/convert-chunk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateRequest(request);
          const body = (await request.json().catch(() => ({}))) as ChunkBody;

          const toolRaw = String(body.tool ?? "").trim();
          if (!isMasterPdfTool(toolRaw)) {
            return jsonResponse({ ok: false, error: "Invalid tool" }, 400);
          }
          const tool = toolRaw as MasterConvertTool;

          const pdfBase64 = String(body.pdfBase64 ?? "").trim();
          if (!pdfBase64) {
            return jsonResponse({ ok: false, error: "pdfBase64 required" }, 400);
          }

          const pageStart = Math.max(1, Number(body.pageStart) || 1);
          const pageEnd = Math.max(pageStart, Number(body.pageEnd) || pageStart);

          const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
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
