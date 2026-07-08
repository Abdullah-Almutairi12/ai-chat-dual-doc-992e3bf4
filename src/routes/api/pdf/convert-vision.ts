import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  jsonResponse,
  unauthorizedResponse,
} from "@/lib/api-auth.server";
import {
  convertPdfWithVision,
  VisionNotConfiguredError,
} from "@/lib/pdf/vision/convert.server";
import { MAX_VISION_FILE_BYTES, MAX_VISION_PAGES, type VisionConvertTool } from "@/lib/pdf/vision/schema";

const ALLOWED_TOOLS = new Set<VisionConvertTool>(["pdf-word", "pdf-ppt"]);

/**
 * POST /api/pdf/convert-vision
 * Multipart: file (PDF, required), tool (pdf-word | pdf-ppt)
 * Returns the converted DOCX/PPTX binary (editable text, Vision AI pipeline).
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
          if (!ALLOWED_TOOLS.has(toolRaw as VisionConvertTool)) {
            return jsonResponse({ ok: false, error: "tool must be pdf-word or pdf-ppt" }, 400);
          }
          const tool = toolRaw as VisionConvertTool;

          const mime = file.type || "";
          if (mime && mime !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return jsonResponse({ ok: false, error: "Only PDF files are supported" }, 400);
          }

          const pdfBytes = new Uint8Array(await file.arrayBuffer());

          const result = await convertPdfWithVision(pdfBytes, tool);

          if (result.pageCount >= MAX_VISION_PAGES) {
            console.warn(
              `[api/pdf/convert-vision] truncated to ${MAX_VISION_PAGES} pages for ${file.name}`,
            );
          }

          const baseName = file.name.replace(/\.pdf$/i, "") || "document";
          const outName = `${baseName}.${result.extension}`;

          return new Response(result.buffer, {
            status: 200,
            headers: {
              "content-type": result.mimeType,
              "content-disposition": `attachment; filename="${encodeURIComponent(outName)}"`,
              "cache-control": "no-store",
              "x-vision-provider": result.provider,
              "x-vision-model": result.model,
              "x-vision-preferred": result.preferredProvider,
              "x-vision-fallback": result.usedProviderFallback ? "true" : "false",
              "x-vision-pages": String(result.pageCount),
            },
          });
        } catch (err) {
          if (err instanceof Error && err.message === "Unauthorized") {
            return unauthorizedResponse();
          }
          if (err instanceof VisionNotConfiguredError) {
            return jsonResponse({ ok: false, error: "Vision AI is not configured", code: "VISION_NOT_CONFIGURED" }, 503);
          }
          console.error("[api/pdf/convert-vision]", err);
          const message = err instanceof Error ? err.message : "Vision conversion failed";
          return jsonResponse({ ok: false, error: message }, 500);
        }
      },
    },
  },
});
