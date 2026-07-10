import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  jsonResponse,
  unauthorizedResponse,
} from "@/lib/api-auth.server";
import {
  convertPdfWithVision,
  MasterEmptyExtractionError,
  VisionNotConfiguredError,
} from "@/lib/pdf/vision/convert.server";
import { officeFileResponse } from "@/lib/pdf/vision/response.server";
import { MasterBuildValidationError } from "@/lib/pdf/vision/validate.server";
import { MAX_VISION_FILE_BYTES, MAX_VISION_PAGES, isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";

/**
 * POST /api/pdf/convert-vision
 * Multipart: file (PDF, required), tool (pdf-word | pdf-ppt | pdf-excel | pdf-html)
 * PDF Quanta Universal Master Engine — returns validated editable output.
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

          if (!(file instanceof File) || file.size === 0) {
            return jsonResponse({ ok: false, error: "No PDF file provided" }, 400);
          }
          if (file.size > MAX_VISION_FILE_BYTES) {
            return jsonResponse({ ok: false, error: `File exceeds ${MAX_VISION_FILE_BYTES / (1024 * 1024)}MB limit` }, 413);
          }
          if (!isMasterPdfTool(toolRaw)) {
            return jsonResponse(
              { ok: false, error: "tool must be pdf-word, pdf-ppt, pdf-excel, or pdf-html" },
              400,
            );
          }
          const tool = toolRaw as MasterConvertTool;

          const mime = file.type || "";
          if (mime && mime !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return jsonResponse({ ok: false, error: "Only PDF files are supported" }, 400);
          }

          const pdfBytes = new Uint8Array(await file.arrayBuffer());

          const result = await convertPdfWithVision(pdfBytes, tool, file.name);

          if (result.pageCount >= MAX_VISION_PAGES) {
            console.warn(
              `[api/pdf/convert-vision] truncated to ${MAX_VISION_PAGES} pages for ${file.name}`,
            );
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
          if (err instanceof Error && err.message === "Unauthorized") {
            return unauthorizedResponse();
          }
          if (err instanceof VisionNotConfiguredError) {
            return jsonResponse({ ok: false, error: "Vision AI is not configured", code: "VISION_NOT_CONFIGURED" }, 503);
          }
          if (err instanceof MasterBuildValidationError || err instanceof MasterEmptyExtractionError) {
            console.error("[api/pdf/convert-vision] validation/extraction failed", err.message);
            return jsonResponse({ ok: false, error: err.message, code: "MASTER_FALLBACK" }, 422);
          }
          if (err instanceof Error && /Office output|ZIP archive/i.test(err.message)) {
            console.error("[api/pdf/convert-vision] binary response failed", err.message);
            return jsonResponse({ ok: false, error: err.message, code: "MASTER_FALLBACK" }, 422);
          }
          console.error("[api/pdf/convert-vision]", err);
          const message = err instanceof Error ? err.message : "Vision conversion failed";
          return jsonResponse({ ok: false, error: message, code: "MASTER_ERROR" }, 500);
        }
      },
    },
  },
});
