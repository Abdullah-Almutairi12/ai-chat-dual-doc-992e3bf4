import { buildDocxFromVisionPages } from "@/lib/pdf/vision/build-docx.server";
import { buildHtmlFromVisionPages } from "@/lib/pdf/vision/build-html.server";
import { buildPptxFromVisionPages, type FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import { buildXlsxFromVisionPages } from "@/lib/pdf/vision/build-xlsx.server";
import { resolveVisionConfig } from "@/lib/pdf/vision/config.server";
import { fuseVisionWithTextLayer } from "@/lib/pdf/vision/fusion.server";
import { OFFICE_EXT, OFFICE_MIME } from "@/lib/pdf/vision/layout-constants";
import { renderPdfToPageImages } from "@/lib/pdf/vision/render.server";
import { extractPdfTextLayers } from "@/lib/pdf/vision/text-layer.server";
import {
  MAX_VISION_PAGES,
  type MasterConvertTool,
  type VisionPage,
} from "@/lib/pdf/vision/schema";
import {
  assertValidOutput,
  countPageContent,
  logMaster,
  MasterBuildValidationError,
  sanitizePages,
} from "@/lib/pdf/vision/validate.server";
import { extractAllPages } from "@/lib/pdf/vision/vision-api.server";
import { isPdfBytes } from "@/lib/pdf/vision/upload-limits";

export type VisionConvertResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  pageCount: number;
  provider: string;
  model: string;
  preferredProvider: string;
  usedProviderFallback: boolean;
};

export type VisionConvertProgress = {
  stage: "render" | "vision" | "build" | "validate";
  page?: number;
  pageCount?: number;
  percent: number;
};

/**
 * PDF Quanta Universal Master Engine — server pipeline:
 * PDF → page images → Claude/OpenAI analysis → validated editable output.
 */
export async function convertPdfWithVision(
  pdfBytes: Uint8Array,
  tool: MasterConvertTool,
  fileName = "document.pdf",
  onProgress?: (p: VisionConvertProgress) => void,
): Promise<VisionConvertResult> {
  const config = resolveVisionConfig();
  if (!config.configured) {
    throw new VisionNotConfiguredError();
  }
  if (!isPdfBytes(pdfBytes)) {
    throw new MasterBuildValidationError("Invalid or corrupt PDF input");
  }

  logMaster("start", {
    tool,
    fileName,
    provider: config.provider,
    preferred: config.preferredProvider,
    bytes: pdfBytes.byteLength,
  });

  onProgress?.({ stage: "render", percent: 5 });
  const [rendered, textLayers] = await Promise.all([
    renderPdfToPageImages(pdfBytes),
    extractPdfTextLayers(pdfBytes),
  ]);
  const pageCount = Math.min(rendered.length, MAX_VISION_PAGES);
  const pages = rendered.slice(0, pageCount);
  const layers = textLayers.slice(0, pageCount);

  logMaster("rendered", { tool, pageCount, totalPages: rendered.length, textLayers: layers.length });

  onProgress?.({ stage: "vision", percent: 15, pageCount });
  const { data: extracted, lastMeta } = await extractAllPages(
    config,
    tool,
    pages.map((p) => ({ pageNumber: p.pageNumber, base64: p.base64 })),
    layers,
  );

  onProgress?.({ stage: "validate", percent: 75, pageCount });

  const fused = fuseVisionWithTextLayer(extracted as VisionPage[], layers);
  const docPages = sanitizePages(fused);
  const contentCount = countPageContent(docPages);
  logMaster("extracted_pages", { tool, pages: docPages.length, blocks: contentCount });
  if (contentCount === 0) {
    logMaster("empty_extraction", { tool });
    throw new MasterEmptyExtractionError();
  }

  onProgress?.({ stage: "build", percent: 85, pageCount });
  const baseTitle = fileName.replace(/\.pdf$/i, "") || "Document";
  const fidelityRenders: FidelityPageRender[] = pages.map((p, i) => ({
    pageNumber: p.pageNumber,
    width: p.width,
    height: p.height,
    base64: p.base64,
    hasTextLayer: layers[i]?.hasTextLayer ?? true,
  }));

  const buffer =
    tool === "pdf-ppt"
      ? await buildPptxFromVisionPages(docPages, fidelityRenders)
      : tool === "pdf-excel"
        ? await buildXlsxFromVisionPages(docPages)
        : tool === "pdf-html"
          ? await buildHtmlFromVisionPages(docPages, baseTitle, fidelityRenders)
          : await buildDocxFromVisionPages(docPages, fidelityRenders);

  assertValidOutput(tool, buffer);

  const resultBase = {
    pageCount,
    provider: lastMeta.provider,
    model: lastMeta.model,
    preferredProvider: config.preferredProvider,
    usedProviderFallback: config.keyFallback || lastMeta.usedProviderFallback,
  };

  logMaster("complete", {
    tool,
    ...resultBase,
    outputBytes: buffer.length,
  });

  const mimeMap: Record<MasterConvertTool, string> = {
    "pdf-word": OFFICE_MIME.docx,
    "pdf-ppt": OFFICE_MIME.pptx,
    "pdf-excel": OFFICE_MIME.xlsx,
    "pdf-html": OFFICE_MIME.html,
  };

  return {
    buffer,
    mimeType: mimeMap[tool],
    extension: OFFICE_EXT[tool],
    ...resultBase,
  };
}

export class VisionNotConfiguredError extends Error {
  constructor() {
    super("Vision AI is not configured");
    this.name = "VisionNotConfiguredError";
  }
}

export class MasterEmptyExtractionError extends Error {
  constructor() {
    super("Master Engine extracted no usable content");
    this.name = "MasterEmptyExtractionError";
  }
}

/** @deprecated Use convertPdfWithVision */
export { convertPdfWithVision as convertPdfWithMasterEngine };
