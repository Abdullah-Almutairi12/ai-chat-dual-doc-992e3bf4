import { createCanvas } from "@napi-rs/canvas";

import { VISION_RENDER_SCALE } from "@/lib/pdf/vision/schema";

export type RenderedPage = {
  pageNumber: number;
  width: number;
  height: number;
  png: Buffer;
  base64: string;
};

/** Render every PDF page to high-resolution PNG buffers (Node.js / Vercel). */
export async function renderPdfToPageImages(
  pdfBytes: Uint8Array,
  scale = VISION_RENDER_SCALE,
): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableWorker: true,
  });

  const pdf = await loadingTask.promise;
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const png = canvas.toBuffer("image/png");
    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      png,
      base64: png.toString("base64"),
    });
  }

  return pages;
}
