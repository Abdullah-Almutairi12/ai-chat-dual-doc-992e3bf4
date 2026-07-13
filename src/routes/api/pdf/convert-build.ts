import { createFileRoute } from "@tanstack/react-router";

import {
  authenticateRequest,
  configErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  ApiConfigError,
} from "@/lib/api-auth.server";
import { buildVisionOutput } from "@/lib/pdf/vision/pipeline.server";
import type { FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import { officeFileResponse } from "@/lib/pdf/vision/response.server";
import { MasterEmptyExtractionError } from "@/lib/pdf/vision/convert.server";
import { MasterBuildValidationError } from "@/lib/pdf/vision/validate.server";
import { isMasterPdfTool, type MasterConvertTool, type VisionPage } from "@/lib/pdf/vision/schema";

type BuildBody = {
  tool?: string;
  fileName?: string;
  pages?: VisionPage[];
  renders?: FidelityPageRender[];
  provider?: string;
  model?: string;
};

/**
 * POST /api/pdf/convert-build
 * JSON: { tool, fileName, pages, renders, provider, model }
 * Assembles final Office/HTML file from chunked Vision extractions.
 */
export const Route = createFileRoute("/api/pdf/convert-build")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateRequest(request);
          const body = (await request.json().catch(() => ({}))) as BuildBody;

          const toolRaw = String(body.tool ?? "").trim();
          if (!isMasterPdfTool(toolRaw)) {
            return jsonResponse({ ok: false, error: "Invalid tool" }, 400);
          }
          const tool = toolRaw as MasterConvertTool;

          const pages = Array.isArray(body.pages) ? body.pages : [];
          const renders = Array.isArray(body.renders) ? body.renders : [];
          const fileName = String(body.fileName ?? "document.pdf").trim();

          if (!pages.length) {
            return jsonResponse({ ok: false, error: "No pages to build", code: "MASTER_FALLBACK" }, 422);
          }

          const result = await buildVisionOutput(
            tool,
            pages,
            renders,
            fileName,
            {
              provider: (body.provider === "anthropic" ? "anthropic" : "openai") as "openai" | "anthropic",
              model: String(body.model ?? ""),
              usedProviderFallback: false,
            },
          );

          const baseName = fileName.replace(/\.pdf$/i, "") || "document";
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
          if (err instanceof MasterBuildValidationError || err instanceof MasterEmptyExtractionError) {
            return jsonResponse({ ok: false, error: err.message, code: "MASTER_FALLBACK" }, 422);
          }
          console.error("[api/pdf/convert-build]", err);
          return jsonResponse(
            { ok: false, error: err instanceof Error ? err.message : "Build failed" },
            500,
          );
        }
      },
    },
  },
});
