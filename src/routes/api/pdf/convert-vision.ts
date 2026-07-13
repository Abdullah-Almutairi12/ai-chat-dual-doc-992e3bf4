import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  configErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  ApiConfigError,
} from "@/lib/api-auth.server";
import {
  convertPdfWithVision,
  MasterEmptyExtractionError,
  VisionNotConfiguredError,
} from "@/lib/pdf/vision/convert.server";
import { officeFileResponse } from "@/lib/pdf/vision/response.server";
import { MasterBuildValidationError } from "@/lib/pdf/vision/validate.server";
import { MAX_VISION_FILE_BYTES, MAX_VISION_PAGES, isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";
import { isPdfBytes } from "@/lib/pdf/vision/upload-limits";

/**
 * POST /api/pdf/convert-vision
 * Multipart: file (PDF), tool — in-memory conversion, no storage.
 */
export const Route = createFileRoute("/api/pdf/convert-vision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateRequest(request);

          const form = await request.formData();
          const file = form.get("file");
          const toolRaw = String(form.get("tool") ?? "").trim();

          if (!isMasterPdfTool(toolRaw)) {
            return jsonResponse(
              { ok: false, error: "tool must be pdf-word, pdf-ppt, pdf-excel, or pdf-html" },
              400,
            );
          }
          const tool = toolRaw as MasterConvertTool;

          if (!(file instanceof File) || file.size === 0) {
            return jsonResponse({ ok: false, error: "No PDF file provided" }, 400);
          }
          if (file.size > MAX_VISION_FILE_BYTES) {
            return jsonResponse(
              { ok: false, error: `File exceeds ${MAX_VISION_FILE_BYTES / (1024 * 1024)}MB direct upload limit`, code: "USE_CHUNKED" },
              413,
            );
          }

          const mime = file.type || "";
          if (mime && mime !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return jsonResponse({ ok: false, error: "Only PDF files are supported" }, 400);
          }

          const pdfBytes = new Uint8Array(await file.arrayBuffer());
          if (!isPdfBytes(pdfBytes)) {
            return jsonResponse({ ok: false, error: "Invalid or corrupt PDF file", code: "INVALID_PDF" }, 400);
          }

          const result = await convertPdfWithVision(pdfBytes, tool, file.name);

          if (result.pageCount >= MAX_VISION_PAGES) {
            console.warn(`[api/pdf/convert-vision] truncated to ${MAX_VISION_PAGES} pages for ${file.name}`);
          }

          const baseName = file.name.replace(/\.pdf$/i, "") || "document";
          const outName = `${baseName}.${result.extension}`;

          return officeFileResponse(result.buffer, outName, result.mimeType, {
            provider: result.provider,
            model: result.model,
            preferredProvider: result.preferredProvider,
            usedProviderFallback: result.usedProviderFallback,
            pageCount: result.pageCount,
          });
        } catch (err) {
          if (err instanceof ApiConfigError) return configErrorResponse(err);
          if (err instanceof Error && err.message === "Unauthorized") return unauthorizedResponse();
          if (err instanceof VisionNotConfiguredError) {
            return jsonResponse({ ok: false, error: "Vision AI is not configured", code: "VISION_NOT_CONFIGURED" }, 503);
          }
          if (err instanceof MasterBuildValidationError || err instanceof MasterEmptyExtractionError) {
            return jsonResponse({ ok: false, error: err.message, code: "MASTER_FALLBACK" }, 422);
          }
          console.error("[api/pdf/convert-vision]", err);
          return jsonResponse(
            { ok: false, error: err instanceof Error ? err.message : "Vision conversion failed", code: "MASTER_ERROR" },
            500,
          );
        }
      },
    },
  },
});
