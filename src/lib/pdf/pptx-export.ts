import type { LayoutBox } from "@/lib/pdf-layout";
import { normalizeArabicText, isRtlDominant } from "./bidi";
import { pixelBoxToInches } from "./layout-fidelity";
import { countUsableTextBoxes, safeLayoutText } from "./layout-quality";
import { packPptxBlob } from "./pptx-pack";
import { loadPptxModule, requireBrowser } from "./runtime";
import type { PdfProgress } from "./progress";

type ProgressFn = (p: PdfProgress) => void;

const MAX_CLIENT_PPT_PAGES = 32;
const PPTX_RENDER_SCALE = 1.5;
const MIN_EDITABLE_BOXES = 2;

function clampInch(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeText(raw: string): string {
  return normalizeArabicText(safeLayoutText(raw));
}

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

function addEditableBox(
  slide: import("pptxgenjs").Slide,
  box: LayoutBox,
  pageW: number,
  pageH: number,
  slideW: number,
  slideH: number,
): void {
  const text = safeText(box.text);
  if (!text || text.length <= 1) return;

  const rtl = box.rtl || isRtlDominant(text);
  const pos = pixelBoxToInches(box, pageW, pageH, slideW, slideH);
  const fontSize = clampInch(pos.fontSize, 9, 28);
  const bold = text.replace(/\s/g, "").length <= 24 && fontSize >= 16;

  slide.addText(text, {
    x: clampInch(pos.x, 0, slideW - 0.05),
    y: clampInch(pos.y, 0, slideH - 0.05),
    w: clampInch(pos.w, 0.35, slideW - pos.x),
    h: clampInch(pos.h, 0.14, slideH - pos.y),
    fontSize,
    bold,
    color: bold ? "1A2530" : "2D3748",
    align: rtl ? "right" : "left",
    rtlMode: rtl,
    fontFace: rtl ? "Arial" : "Calibri",
    wrap: true,
    valign: "top",
  });
}

/** Editable PPTX — positioned text boxes; OCR repairs designed PDF glyph layers. */
async function pdfToPptxEditable(file: File, onProgress?: ProgressFn): Promise<Blob> {
  const { extractLayout } = await import("@/lib/pdf-layout");
  const pptxModule = await loadPptxModule();
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;

  onProgress?.({ stage: "extract", percent: 5 });
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
      backdrop: "scanned-only",
      ocr: "optional",
      repairBrokenText: true,
      renderScale: PPTX_RENDER_SCALE,
      jpegQuality: 0.75,
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
    const usable = countUsableTextBoxes(page.boxes);

    if (usable >= MIN_EDITABLE_BOXES) {
      for (const box of page.boxes) {
        addEditableBox(slide, box, page.width, page.height, slideW, slideH);
      }
      continue;
    }

    if (page.image) {
      slide.addImage({ data: page.image, x: 0, y: 0, w: slideW, h: slideH });
    }
    for (const box of page.boxes) {
      addEditableBox(slide, box, page.width, page.height, slideW, slideH);
    }
  }

  onProgress?.({ stage: "pack", percent: 95 });
  return packPptxBlob(pptx);
}

/** PDF → PowerPoint with editable positioned Arabic/English text. */
export async function pdfToPptx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  return pdfToPptxEditable(file, onProgress);
}

export { pdfToPptxEditable };
