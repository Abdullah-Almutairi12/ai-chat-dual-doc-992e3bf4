import { loadPdfLib, pdfLibToBlob } from "./loader";
import { pagePercent, stageProgress, type ProgressFn } from "./progress";
import { loadPdfLibModule, requireBrowser } from "./runtime";
export type AnnotationType = "highlight" | "text" | "rectangle";

export type Annotation = {
  type: AnnotationType;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: [number, number, number];
};

export async function applyAnnotations(file: File, annotations: Annotation[], onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  onProgress?.(stageProgress("annotate", 15));
  const { rgb, StandardFonts } = await loadPdfLibModule();  const doc = await loadPdfLib(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const ann of annotations) {
    const page = doc.getPage(ann.page - 1);
    if (!page) continue;
    const { height } = page.getSize();
    const y = height - ann.y - (ann.height ?? 0);
    const color = ann.color ?? [1, 1, 0];

    switch (ann.type) {
      case "highlight":
        page.drawRectangle({
          x: ann.x,
          y,
          width: ann.width ?? 100,
          height: ann.height ?? 14,
          color: rgb(color[0], color[1], color[2]),
          opacity: 0.35,
        });
        break;
      case "rectangle":
        page.drawRectangle({
          x: ann.x,
          y,
          width: ann.width ?? 80,
          height: ann.height ?? 40,
          borderColor: rgb(0.2, 0.4, 0.9),
          borderWidth: 1.5,
        });
        break;
      case "text":
        page.drawText(ann.text ?? "", {
          x: ann.x,
          y,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        break;
    }
  }
  onProgress?.(stageProgress("pack", 90));
  return pdfLibToBlob(doc);
}

export async function addTextToPdf(
  file: File,
  items: { page: number; x: number; y: number; text: string; size?: number }[],
): Promise<Blob> {
  return applyAnnotations(
    file,
    items.map((i) => ({ type: "text" as const, page: i.page, x: i.x, y: i.y, text: i.text })),
  );
}

/**
 * True redaction: rasterizes affected pages and paints over the regions on the
 * pixel layer, then rebuilds the PDF from those flattened images. A vector
 * black box (drawn on top of the original content stream) is NOT sufficient —
 * the covered text remains selectable/extractable underneath it. Pages with
 * no redaction stay as original vector pages so text/search is preserved there.
 */
export async function redactRegions(
  file: File,
  regions: { page: number; x: number; y: number; width: number; height: number }[],
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  if (!regions.length) return loadPdfLib(file).then(pdfLibToBlob);

  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const { PDFDocument } = await loadPdfLibModule();
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdfjsDoc = await pdfjs.getDocument({ data: buf }).promise;
  const srcDoc = await loadPdfLib(file);
  const newDoc = await PDFDocument.create();

  const byPage = new Map<number, typeof regions>();
  for (const r of regions) {
    byPage.set(r.page, [...(byPage.get(r.page) ?? []), r]);
  }

  const pageCount = srcDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const pageRegions = byPage.get(pageNum);

    if (!pageRegions?.length) {
      const [copied] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(copied);
      onProgress?.(pagePercent(pageNum, pageCount, { stage: "redact" }));
      continue;
    }

    const scale = 3;
    const { canvas, width, height } = await renderPageToCanvas(pdfjsDoc, pageNum, scale);
    const ctx = canvas.getContext("2d")!;
    const srcPage = srcDoc.getPage(i);
    const { height: pdfHeight } = srcPage.getSize();

    ctx.fillStyle = "#000000";
    for (const r of pageRegions) {
      // PDF coordinates are bottom-left origin; canvas is top-left — flip Y, then scale.
      const canvasX = r.x * scale;
      const canvasY = (pdfHeight - r.y - r.height) * scale;
      ctx.fillRect(canvasX, canvasY, r.width * scale, r.height * scale);
    }

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Redaction flatten failed"))), "image/png");
    });
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const newPage = newDoc.addPage([width / scale, height / scale]);
    const img = await newDoc.embedPng(pngBytes);
    newPage.drawImage(img, { x: 0, y: 0, width: newPage.getWidth(), height: newPage.getHeight() });

    onProgress?.(pagePercent(pageNum, pageCount, { stage: "redact" }));
  }

  return pdfLibToBlob(newDoc);
}

export async function insertImageOnPage(
  file: File,
  pageNum: number,
  imageBytes: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<Blob> {
  requireBrowser();
  const doc = await loadPdfLib(file);
  const page = doc.getPage(pageNum - 1);
  const img = await doc.embedPng(imageBytes).catch(() => doc.embedJpg(imageBytes));
  const { height } = page.getSize();
  page.drawImage(img, { x, y: height - y - h, width: w, height: h });
  return pdfLibToBlob(doc);
}
