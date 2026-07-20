/**
 * Layout-preserving PDF conversion.
 *
 * Unlike plain text extraction, this keeps the *visual design* of every page:
 * tables, columns, alignments, font sizes and embedded images stay in their
 * exact positions. We do this the same way the PDF.js viewer does — render
 * each page to a high-resolution raster (the exact original design) and lay a
 * positioned, selectable text layer on top of it.
 *
 * - Text-based PDFs: each glyph run is placed using its PDF transform matrix,
 *   so Arabic text sits inside its original box in logical (RTL-aware) order.
 * - Scanned / image PDFs: the page image IS the backdrop and OCR word/line
 *   boxes (Tesseract `ara+eng`) are positioned over their detected coordinates.
 *
 * The result exports to a standalone, self-contained HTML file that mirrors the
 * uploaded document pixel-for-pixel while remaining searchable and copyable.
 */

import { isRtlText } from "./pdf-extract";
import { groupIntoLines, joinLineItems, normalizeArabicText, rtlSpanStyle } from "./pdf/bidi";
import { isBrokenTextLayout } from "./pdf/layout-quality";
import { loadPdfjsWithWorker } from "./pdf/pdfjs-worker";

export type LayoutStage = "loading" | "rendering" | "ocr" | "done";

export type LayoutProgress = {
  stage: LayoutStage;
  page: number;
  pageCount: number;
  percent: number;
};

export type LayoutBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  text: string;
  rtl: boolean;
};

export type LayoutPage = {
  width: number;
  height: number;
  /** JPEG data URL of the rendered page (empty for text-only pages when backdrop is skipped). */
  image: string;
  boxes: LayoutBox[];
  /** True when the page had no extractable text layer and relied on OCR/image. */
  isScanned: boolean;
};

export type LayoutResult = {
  pages: LayoutPage[];
  isRtl: boolean;
  usedOcr: boolean;
  ocrPageCount: number;
};

type ProgressFn = (p: LayoutProgress) => void;

// Render scale — higher = crisper backdrop. Coordinates use this same space.
const RENDER_SCALE = 2;
const MIN_TEXT_CHARS = 12;
const OCR_LANGS = "ara+eng";

function meaningfulLength(s: string): number {
  return s.replace(/\s+/g, "").length;
}

async function loadPdfjs() {
  return loadPdfjsWithWorker();
}

async function renderCanvas(page: any, viewport: any): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") {
    throw new Error("Canvas rendering requires a browser environment");
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Build positioned boxes from a real text layer with bidi-correct line grouping. */
function boxesFromTextLayer(pdfjs: any, content: any, viewport: any): LayoutBox[] {
  const raw: { text: string; left: number; top: number; width: number; height: number }[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str || !item.str.trim()) continue;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[1], tx[3]) || Math.abs(tx[3]);
    const left = tx[4];
    const top = tx[5] - fontHeight;
    const width = (item.width ?? 0) * viewport.scale;
    raw.push({
      text: item.str,
      left,
      top,
      width: width || fontHeight * item.str.length * 0.5,
      height: fontHeight,
    });
  }
  const lines = groupIntoLines(raw);
  const boxes: LayoutBox[] = [];
  for (const line of lines) {
    const text = normalizeArabicText(joinLineItems(line));
    if (!text) continue;
    const first = reorderLineForBox(line)[0];
    const last = reorderLineForBox(line)[reorderLineForBox(line).length - 1];
    boxes.push({
      left: Math.min(first.left, last.left),
      top: first.top,
      width: Math.max(last.left + last.width - first.left, first.width),
      height: first.height,
      fontSize: first.height,
      text,
      rtl: isRtlText(text),
    });
  }
  return boxes;
}

function reorderLineForBox(line: { left: number; top: number; width: number; height: number; text: string }[]) {
  const text = line.map((i) => i.text).join("");
  const rtl = isRtlText(text);
  return [...line].sort((a, b) => (rtl ? b.left - a.left : a.left - b.left));
}

/** Build positioned boxes from OCR line data. */
function boxesFromOcr(data: any): LayoutBox[] {
  const boxes: LayoutBox[] = [];
  const blocks = data?.blocks ?? [];
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text ?? "").trim();
        if (!text) continue;
        const b = line.bbox;
        if (!b) continue;
        boxes.push({
          left: b.x0,
          top: b.y0,
          width: b.x1 - b.x0,
          height: b.y1 - b.y0,
          fontSize: (b.y1 - b.y0) * 0.82,
          text,
          rtl: isRtlText(text),
        });
      }
    }
  }
  return boxes;
}

export async function extractLayout(
  file: File,
  onProgress?: ProgressFn,
  opts?: {
    backdrop?: "all" | "scanned-only";
    ocr?: "full" | "optional" | "skip";
    repairBrokenText?: boolean;
    renderScale?: number;
    jpegQuality?: number;
  },
): Promise<LayoutResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Layout extraction requires a browser environment");
  }
  const pdfjs = await loadPdfjs();
  onProgress?.({ stage: "loading", page: 0, pageCount: 0, percent: 2 });

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount = pdf.numPages;

  const backdropMode = opts?.backdrop ?? "all";
  const ocrMode = opts?.ocr ?? "full";
  const repairBroken = opts?.repairBrokenText === true;
  const renderScale = opts?.renderScale ?? RENDER_SCALE;
  const jpegDefault = opts?.jpegQuality ?? 0.82;

  const pages: LayoutPage[] = [];
  const scannedIdx: number[] = [];
  let rtlVotes = 0;

  // Pass 1 — render every page + place text-layer boxes.
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = await renderCanvas(page, viewport);

    const content = await page.getTextContent();
    let raw = "";
    for (const item of content.items) if ("str" in item) raw += item.str + " ";
    const hasTextLayer = meaningfulLength(raw) >= MIN_TEXT_CHARS;
    const isScanned = !hasTextLayer;
    const image =
      backdropMode === "all" || isScanned
        ? canvas.toDataURL("image/jpeg", isScanned ? Math.min(jpegDefault, 0.72) : jpegDefault)
        : "";

    const boxes = hasTextLayer ? boxesFromTextLayer(pdfjs, content, viewport) : [];
    if (!hasTextLayer) scannedIdx.push(i - 1);
    if (isRtlText(raw)) rtlVotes++;

    pages.push({ width: canvas.width, height: canvas.height, image, boxes, isScanned });
    onProgress?.({
      stage: "rendering",
      page: i,
      pageCount,
      percent: 2 + Math.round((i / pageCount) * (scannedIdx.length ? 45 : 96)),
    });
  }

  if (repairBroken) {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]!;
      if (!p.isScanned && isBrokenTextLayout(p.boxes, p.width)) {
        if (!scannedIdx.includes(i)) scannedIdx.push(i);
        p.boxes = [];
        if (!p.image) {
          const page = await pdf.getPage(i + 1);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = await renderCanvas(page, viewport);
          p.image = canvas.toDataURL("image/jpeg", jpegDefault);
        }
      }
    }
  }

  // Pass 2 — OCR scanned / repaired pages (optional; never aborts the whole export).
  if (scannedIdx.length > 0 && ocrMode !== "skip") {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(OCR_LANGS, 1);
      try {
        for (let k = 0; k < scannedIdx.length; k++) {
          const pageIdx = scannedIdx[k]!;
          const pageData = pages[pageIdx];
          if (!pageData?.image) continue;
          try {
            const { data } = await Promise.race([
              worker.recognize(pageData.image, {}, { blocks: true } as object),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("ocr_timeout")), 90_000),
              ),
            ]);
            const boxes = boxesFromOcr(data);
            if (boxes.length) pages[pageIdx]!.boxes = boxes;
            if (isRtlText(data?.text ?? "")) rtlVotes++;
          } catch (pageErr) {
            console.warn("[extractLayout] OCR page failed", pageIdx + 1, pageErr);
            if (ocrMode === "full") throw pageErr;
          }
          onProgress?.({
            stage: "ocr",
            page: pageIdx + 1,
            pageCount,
            percent: 47 + Math.round(((k + 1) / scannedIdx.length) * 51),
          });
        }
      } finally {
        await worker.terminate();
      }
    } catch (ocrErr) {
      console.warn("[extractLayout] OCR skipped", ocrErr);
      if (ocrMode === "full") throw ocrErr;
    }
  }

  onProgress?.({ stage: "done", page: pageCount, pageCount, percent: 100 });
  return {
    pages,
    isRtl: rtlVotes > pageCount / 2,
    usedOcr: scannedIdx.length > 0,
    ocrPageCount: scannedIdx.length,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Serialize a layout result into a standalone, print-ready HTML document. */
export function layoutToHtml(result: LayoutResult, title: string): string {
  const dir = result.isRtl ? "rtl" : "ltr";
  const pagesHtml = result.pages
    .map((p) => {
      const spans = p.boxes
        .map((b) => {
          const style =
            `left:${b.left.toFixed(1)}px;top:${b.top.toFixed(1)}px;` +
            `width:${Math.max(b.width, b.fontSize).toFixed(1)}px;height:${b.height.toFixed(1)}px;` +
            `font-size:${b.fontSize.toFixed(1)}px;line-height:${b.height.toFixed(1)}px;` +
            rtlSpanStyle(b.rtl);
          return `<span class="tb" dir="${b.rtl ? "rtl" : "ltr"}" style="${style}">${escapeHtml(b.text)}</span>`;
        })
        .join("");
      return (
        `<section class="page" style="width:${p.width}px;height:${p.height}px">` +
        `<img class="bg" src="${p.image}" width="${p.width}" height="${p.height}" alt="Document page"/>` +
        `<div class="layer">${spans}</div></section>`
      );
    })
    .join("\n");

  return `<!doctype html>
<html lang="${result.isRtl ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#525659; padding:24px 0; font-family:"Segoe UI",Tahoma,Arial,sans-serif; }
  .page { position:relative; margin:0 auto 24px; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.35); max-width:100%; }
  .bg { display:block; width:100%; height:auto; }
  .layer { position:absolute; inset:0; }
  .tb { position:absolute; color:transparent; white-space:pre; transform-origin:0 0; overflow:hidden; unicode-bidi:isolate; font-family:"Segoe UI","Traditional Arabic",Tahoma,Arial,sans-serif; }
  .tb::selection { background:rgba(70,120,255,.35); }
  @media print {
    body { background:#fff; padding:0; }
    .page { box-shadow:none; margin:0; page-break-after:always; }
  }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}
