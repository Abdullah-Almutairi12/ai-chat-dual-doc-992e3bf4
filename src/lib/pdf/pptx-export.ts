import { normalizeArabicText, isRtlDominant } from "./bidi";
import { pixelBoxToInches } from "./layout-fidelity";
import { packPptxBlob } from "./pptx-pack";
import { loadPdfjs } from "./loader";
import { loadPptxModule, requireBrowser } from "./runtime";
import type { PdfProgress } from "./progress";

type ProgressFn = (p: PdfProgress) => void;

const MAX_CLIENT_PPT_PAGES = 30;
const PORTRAIT_LAYOUT = "PDFQUANTA_PORTRAIT";

function definePortraitLayout(pptx: import("pptxgenjs").default): void {
  pptx.defineLayout({ name: PORTRAIT_LAYOUT, width: 8.5, height: 11 });
  pptx.layout = PORTRAIT_LAYOUT;
}

function clampInch(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeText(raw: string): string {
  return normalizeArabicText(raw).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}

/** Last-resort PPTX: one slide per page with extracted plain text (no OCR, no images). */
export async function pdfToPptxSimple(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const pdfjs = await loadPdfjs();
  const pptxModule = await loadPptxModule();
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_CLIENT_PPT_PAGES);
  const pptx = new PptxGenJS();
  definePortraitLayout(pptx);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let raw = "";
    for (const item of content.items) {
      if ("str" in item && item.str) raw += item.str + " ";
    }
    const text = safeText(raw) || `Page ${i}`;
    const rtl = isRtlDominant(text);
    const slide = pptx.addSlide();
    slide.addText(text, {
      x: 0.5,
      y: 0.5,
      w: 7.5,
      h: 9,
      fontSize: 14,
      align: rtl ? "right" : "left",
      rtlMode: rtl,
      fontFace: rtl ? "Arial" : "Calibri",
      valign: "top",
      wrap: true,
    });
    onProgress?.({
      stage: "simple-pack",
      percent: 10 + Math.round((i / pageCount) * 80),
      page: i,
      pageCount,
    });
  }

  onProgress?.({ stage: "pack", percent: 95 });
  return packPptxBlob(pptx);
}

/** PDF → PowerPoint with layout boxes; falls back to simple text export. */
export async function pdfToPptx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();

  try {
    return await pdfToPptxWithLayout(file, onProgress);
  } catch (layoutErr) {
    console.warn("[pdfToPptx] layout export failed, using simple fallback", layoutErr);
    onProgress?.({ stage: "client-fallback", percent: 10 });
    return pdfToPptxSimple(file, onProgress);
  }
}

async function pdfToPptxWithLayout(file: File, onProgress?: ProgressFn): Promise<Blob> {
  const { extractLayout } = await import("@/lib/pdf-layout");
  const pptxModule = await loadPptxModule();
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;

  onProgress?.({ stage: "layout", percent: 5 });
  const layout = await extractLayout(
    file,
    (p) =>
      onProgress?.({
        stage: p.stage,
        percent: 5 + Math.round(p.percent * 0.85),
        page: p.page,
        pageCount: p.pageCount,
      }),
    { backdrop: "scanned-only", ocr: "optional" },
  );

  const pages = layout.pages.slice(0, MAX_CLIENT_PPT_PAGES);
  if (!pages.length) throw new Error("No pages to export");

  const pptx = new PptxGenJS();
  definePortraitLayout(pptx);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const slide = pptx.addSlide();

    if (page.isScanned && page.image) {
      slide.addImage({ data: page.image, x: 0, y: 0, w: 8.5, h: 11 });
    }

    for (const box of page.boxes) {
      const text = safeText(box.text);
      if (!text) continue;
      const rtl = box.rtl || isRtlDominant(text);
      const pos = pixelBoxToInches(box, page.width, page.height);
      slide.addText(text, {
        x: clampInch(pos.x, 0, 8),
        y: clampInch(pos.y, 0, 10),
        w: clampInch(pos.w, 0.2, 8),
        h: clampInch(pos.h, 0.1, 10),
        fontSize: clampInch(pos.fontSize, 8, 36),
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Arial" : "Calibri",
        wrap: true,
        ...(page.isScanned ? { color: "FFFFFF", transparency: 100 } : {}),
      });
    }

    if (!page.boxes.length && !page.isScanned) {
      slide.addText(`Page ${i + 1}`, { x: 0.5, y: 4, w: 7.5, h: 0.5, fontSize: 16, align: "center" });
    }
  }

  onProgress?.({ stage: "pack", percent: 95 });
  return packPptxBlob(pptx);
}
