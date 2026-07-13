/**
 * PDF Quanta — Adobe-style extraction pipeline.
 * PDF → high-res images + text bounding boxes → Vision AI → fused JSON → format builders.
 */

import { buildDocxFromVisionPages } from "@/lib/pdf/vision/build-docx.server";
import { buildHtmlFromVisionPages } from "@/lib/pdf/vision/build-html.server";
import { buildPptxFromVisionPages, type FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import { buildXlsxFromVisionPages } from "@/lib/pdf/vision/build-xlsx.server";
import { resolveVisionConfig } from "@/lib/pdf/vision/config.server";
import { fuseVisionWithTextLayer, enforceLanguageIntegrity } from "@/lib/pdf/vision/fusion.server";
import { OFFICE_EXT, OFFICE_MIME } from "@/lib/pdf/vision/layout-constants";
import { renderPdfToPageImages, type RenderedPage } from "@/lib/pdf/vision/render.server";
import { MAX_VISION_PAGES, type MasterConvertTool, type VisionPage } from "@/lib/pdf/vision/schema";
import { extractPdfTextLayers, type PageTextLayer } from "@/lib/pdf/vision/text-layer.server";
import {
  assertValidOutput,
  countPageContent,
  logMaster,
  MasterBuildValidationError,
  sanitizePages,
} from "@/lib/pdf/vision/validate.server";
import { extractAllPages, type VisionCallMeta } from "@/lib/pdf/vision/vision-api.server";
import { isPdfBytes } from "@/lib/pdf/vision/upload-limits";

export type PdfPipelineContext = {
  pdfBytes: Uint8Array;
  rendered: RenderedPage[];
  textLayers: PageTextLayer[];
  totalPages: number;
  pageCount: number;
};

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

export type ChunkExtractResult = {
  pages: VisionPage[];
  renders: FidelityPageRender[];
  meta: VisionCallMeta;
  totalPages: number;
  pageCount: number;
};

/** Load render + text-layer context once per PDF (shared across chunk requests). */
export async function loadPdfPipelineContext(pdfBytes: Uint8Array): Promise<PdfPipelineContext> {
  if (!isPdfBytes(pdfBytes)) {
    throw new MasterBuildValidationError("Invalid or corrupt PDF input");
  }
  const [rendered, textLayers] = await Promise.all([
    renderPdfToPageImages(pdfBytes),
    extractPdfTextLayers(pdfBytes),
  ]);
  const totalPages = rendered.length;
  const pageCount = Math.min(totalPages, MAX_VISION_PAGES);
  return { pdfBytes, rendered, textLayers, totalPages, pageCount };
}

function sliceContext(ctx: PdfPipelineContext, pageStart: number, pageEnd: number) {
  const start = Math.max(1, pageStart);
  const end = Math.min(pageEnd, ctx.pageCount);
  const rendered = ctx.rendered.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
  const textLayers = ctx.textLayers.filter((l) => l.pageNumber >= start && l.pageNumber <= end);
  return { rendered, textLayers, start, end };
}

function toFidelityRenders(
  rendered: RenderedPage[],
  textLayers: PageTextLayer[],
): FidelityPageRender[] {
  return rendered.map((p) => {
    const layer = textLayers.find((l) => l.pageNumber === p.pageNumber);
    return {
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
      base64: p.base64,
      hasTextLayer: layer?.hasTextLayer ?? true,
    };
  });
}

/** Extract Vision AI JSON for a page range (1-based inclusive). */
export async function extractVisionChunk(
  ctx: PdfPipelineContext,
  tool: MasterConvertTool,
  pageStart: number,
  pageEnd: number,
): Promise<ChunkExtractResult> {
  const config = resolveVisionConfig();
  if (!config.configured) throw new VisionNotConfiguredError();

  const { rendered, textLayers } = sliceContext(ctx, pageStart, pageEnd);
  if (!rendered.length) {
    return {
      pages: [],
      renders: [],
      meta: { provider: config.provider, model: "", usedProviderFallback: false },
      totalPages: ctx.totalPages,
      pageCount: ctx.pageCount,
    };
  }

  const { data: extracted, lastMeta } = await extractAllPages(
    config,
    tool,
    rendered.map((p) => ({ pageNumber: p.pageNumber, base64: p.base64 })),
    textLayers,
  );

  const fused = fuseVisionWithTextLayer(extracted, textLayers);
  const pages = enforceLanguageIntegrity(sanitizePages(fused), textLayers);

  return {
    pages,
    renders: toFidelityRenders(rendered, textLayers),
    meta: lastMeta,
    totalPages: ctx.totalPages,
    pageCount: ctx.pageCount,
  };
}

/** Assemble final Office/HTML binary from extracted pages. */
export async function buildVisionOutput(
  tool: MasterConvertTool,
  pages: VisionPage[],
  renders: FidelityPageRender[],
  fileName: string,
  meta: VisionCallMeta,
): Promise<VisionConvertResult> {
  const config = resolveVisionConfig();
  const docPages = sanitizePages(pages);
  const contentCount = countPageContent(docPages);
  if (contentCount === 0) throw new MasterEmptyExtractionError();

  const baseTitle = fileName.replace(/\.pdf$/i, "") || "Document";
  const buffer =
    tool === "pdf-ppt"
      ? await buildPptxFromVisionPages(docPages, renders)
      : tool === "pdf-excel"
        ? await buildXlsxFromVisionPages(docPages)
        : tool === "pdf-html"
          ? await buildHtmlFromVisionPages(docPages, baseTitle, renders)
          : await buildDocxFromVisionPages(docPages, renders);

  assertValidOutput(tool, buffer);

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
    pageCount: docPages.length,
    provider: meta.provider,
    model: meta.model,
    preferredProvider: config.preferredProvider,
    usedProviderFallback: config.keyFallback || meta.usedProviderFallback,
  };
}

/** Full single-request pipeline (small PDFs only). */
export async function convertPdfWithVision(
  pdfBytes: Uint8Array,
  tool: MasterConvertTool,
  fileName = "document.pdf",
  onProgress?: (p: VisionConvertProgress) => void,
): Promise<VisionConvertResult> {
  const config = resolveVisionConfig();
  if (!config.configured) throw new VisionNotConfiguredError();

  logMaster("start", { tool, fileName, provider: config.provider, bytes: pdfBytes.byteLength });

  onProgress?.({ stage: "render", percent: 5 });
  const ctx = await loadPdfPipelineContext(pdfBytes);

  onProgress?.({ stage: "vision", percent: 15, pageCount: ctx.pageCount });
  const chunk = await extractVisionChunk(ctx, tool, 1, ctx.pageCount);

  onProgress?.({ stage: "build", percent: 85, pageCount: ctx.pageCount });
  const result = await buildVisionOutput(tool, chunk.pages, chunk.renders, fileName, chunk.meta);

  logMaster("complete", { tool, pageCount: result.pageCount, outputBytes: result.buffer.length });
  return result;
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
