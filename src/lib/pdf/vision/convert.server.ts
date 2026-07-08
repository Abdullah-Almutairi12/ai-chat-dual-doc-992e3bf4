import { buildDocxFromVisionPages } from "@/lib/pdf/vision/build-docx.server";
import { buildPptxFromVisionSlides } from "@/lib/pdf/vision/build-pptx.server";
import { resolveVisionConfig } from "@/lib/pdf/vision/config.server";
import { renderPdfToPageImages } from "@/lib/pdf/vision/render.server";
import {
  MAX_VISION_PAGES,
  type VisionConvertTool,
  type VisionPage,
  type VisionSlide,
} from "@/lib/pdf/vision/schema";
import { extractAllPages } from "@/lib/pdf/vision/vision-api.server";

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
  stage: "render" | "vision" | "build";
  page?: number;
  pageCount?: number;
  percent: number;
};

/**
 * Full server-side Vision conversion pipeline:
 * PDF bytes → page PNGs → Vision API → editable DOCX/PPTX.
 */
export async function convertPdfWithVision(
  pdfBytes: Uint8Array,
  tool: VisionConvertTool,
  onProgress?: (p: VisionConvertProgress) => void,
): Promise<VisionConvertResult> {
  const config = resolveVisionConfig();
  if (!config.configured) {
    throw new VisionNotConfiguredError();
  }

  onProgress?.({ stage: "render", percent: 5 });
  const rendered = await renderPdfToPageImages(pdfBytes);
  const pageCount = Math.min(rendered.length, MAX_VISION_PAGES);
  const pages = rendered.slice(0, pageCount);

  onProgress?.({ stage: "vision", percent: 15, pageCount });
  const { data: extracted, lastMeta } = await extractAllPages(
    config,
    tool,
    pages.map((p) => ({ pageNumber: p.pageNumber, base64: p.base64 })),
  );

  onProgress?.({ stage: "build", percent: 85, pageCount });

  const resultBase = {
    pageCount,
    provider: lastMeta.provider,
    model: lastMeta.model,
    preferredProvider: config.preferredProvider,
    usedProviderFallback: config.keyFallback || lastMeta.usedProviderFallback,
  };

  if (tool === "pdf-word") {
    const buffer = await buildDocxFromVisionPages(extracted as VisionPage[]);
    return {
      buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
      ...resultBase,
    };
  }

  const buffer = await buildPptxFromVisionSlides(extracted as VisionSlide[]);
  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
    ...resultBase,
  };
}

export class VisionNotConfiguredError extends Error {
  constructor() {
    super("Vision AI is not configured");
    this.name = "VisionNotConfiguredError";
  }
}
