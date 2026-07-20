import type { LayoutBox } from "@/lib/pdf-layout";
import { normalizeArabicText, isRtlDominant } from "./bidi";
import { pixelBoxToInches } from "./layout-fidelity";
import { packPptxBlob } from "./pptx-pack";
import { loadPdfjs, renderPageToCanvas } from "./loader";
import { loadPptxModule, requireBrowser } from "./runtime";
import type { PdfProgress } from "./progress";

type ProgressFn = (p: PdfProgress) => void;

const MAX_CLIENT_PPT_PAGES = 32;
const PPTX_RENDER_SCALE = 1.35;
const PPTX_JPEG_QUALITY = 0.72;

function clampInch(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeText(raw: string): string {
  return normalizeArabicText(raw).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}

/** Designed PDFs often expose one glyph box per character — overlay breaks layout. */
function isBrokenTextLayout(boxes: LayoutBox[], pageW: number): boolean {
  if (boxes.length === 0) return false;
  if (boxes.length > 100) return true;

  const nonSpace = boxes.filter((b) => safeText(b.text).length > 0);
  if (!nonSpace.length) return true;

  const tiny = nonSpace.filter((b) => b.text.replace(/\s/g, "").length <= 1).length;
  if (tiny / nonSpace.length > 0.45) return true;

  const avgW = nonSpace.reduce((s, b) => s + b.width, 0) / nonSpace.length;
  if (avgW < pageW * 0.018) return true;

  return false;
}

/** Match slide size to PDF page aspect ratio (portrait decks, landscape decks, custom). */
function slideSizeForPage(pageW: number, pageH: number): { layoutName: string; w: number; h: number } {
  const aspect = pageW / pageH;
  if (aspect >= 1.25) {
    const w = 10;
    return { layoutName: "PDFQUANTA_WIDE", w, h: w / aspect };
  }
  if (aspect <= 0.8) {
    return { layoutName: "PDFQUANTA_PORTRAIT", w: 8.5, h: 11 };
  }
  const w = 8.5;
  return { layoutName: "PDFQUANTA_CUSTOM", w, h: w / aspect };
}

function defineSlideLayout(pptx: import("pptxgenjs").default, w: number, h: number, name: string): void {
  pptx.defineLayout({ name, width: w, height: h });
  pptx.layout = name;
}

/** Visual-fidelity PPTX: each PDF page becomes a slide with its rendered design as background. */
async function pdfToPptxVisual(file: File, onProgress?: ProgressFn): Promise<Blob> {
  const { extractLayout } = await import("@/lib/pdf-layout");
  const pptxModule = await loadPptxModule();
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;

  onProgress?.({ stage: "render", percent: 5 });
  const layout = await extractLayout(
    file,
    (p) =>
      onProgress?.({
        stage: p.stage,
        percent: 5 + Math.round(p.percent * 0.85),
        page: p.page,
        pageCount: p.pageCount,
      }),
    {
      backdrop: "all",
      ocr: "skip",
      renderScale: PPTX_RENDER_SCALE,
      jpegQuality: PPTX_JPEG_QUALITY,
    },
  );

  const pages = layout.pages.slice(0, MAX_CLIENT_PPT_PAGES);
  if (!pages.length) throw new Error("No pages to export");

  const first = pages[0]!;
  const { layoutName, w: slideW, h: slideH } = slideSizeForPage(first.width, first.height);

  const pptx = new PptxGenJS();
  defineSlideLayout(pptx, slideW, slideH, layoutName);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const slide = pptx.addSlide();

    if (page.image) {
      slide.addImage({ data: page.image, x: 0, y: 0, w: slideW, h: slideH });
    }

    const broken = isBrokenTextLayout(page.boxes, page.width);
    if (!broken && page.boxes.length > 0) {
      for (const box of page.boxes) {
        const text = safeText(box.text);
        if (!text || text.length <= 1) continue;
        const rtl = box.rtl || isRtlDominant(text);
        const pos = pixelBoxToInches(box, page.width, page.height, slideW, slideH);
        slide.addText(text, {
          x: clampInch(pos.x, 0, slideW - 0.1),
          y: clampInch(pos.y, 0, slideH - 0.1),
          w: clampInch(pos.w, 0.3, slideW),
          h: clampInch(pos.h, 0.12, slideH),
          fontSize: clampInch(pos.fontSize, 8, 36),
          align: rtl ? "right" : "left",
          rtlMode: rtl,
          fontFace: rtl ? "Arial" : "Calibri",
          wrap: false,
          color: "FFFFFF",
          transparency: 100,
        });
      }
    }
  }

  onProgress?.({ stage: "pack", percent: 95 });
  return packPptxBlob(pptx);
}

/** Fallback: render pages directly to images (no text overlay). */
async function pdfToPptxImageOnly(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const pdfjs = await loadPdfjs();
  const pptxModule = await loadPptxModule();
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_CLIENT_PPT_PAGES);

  const firstCanvas = await renderPageToCanvas(pdf, 1, PPTX_RENDER_SCALE);
  const { layoutName, w: slideW, h: slideH } = slideSizeForPage(firstCanvas.width, firstCanvas.height);

  const pptx = new PptxGenJS();
  defineSlideLayout(pptx, slideW, slideH, layoutName);

  for (let i = 1; i <= pageCount; i++) {
    const { canvas } = await renderPageToCanvas(pdf, i, PPTX_RENDER_SCALE);
    const image = canvas.toDataURL("image/jpeg", PPTX_JPEG_QUALITY);
    const slide = pptx.addSlide();
    slide.addImage({ data: image, x: 0, y: 0, w: slideW, h: slideH });
    onProgress?.({
      stage: "render",
      percent: 10 + Math.round((i / pageCount) * 80),
      page: i,
      pageCount,
    });
  }

  onProgress?.({ stage: "pack", percent: 95 });
  return packPptxBlob(pptx);
}

/** PDF → PowerPoint preserving visual design (input ≈ output). */
export async function pdfToPptx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();

  try {
    return await pdfToPptxVisual(file, onProgress);
  } catch (visualErr) {
    console.warn("[pdfToPptx] visual export failed, using image-only fallback", visualErr);
    onProgress?.({ stage: "image-fallback", percent: 8 });
    return pdfToPptxImageOnly(file, onProgress);
  }
}

export { pdfToPptxVisual, pdfToPptxImageOnly };
