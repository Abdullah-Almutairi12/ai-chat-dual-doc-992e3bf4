import { yieldToMain } from "./batch";
import { loadPdfLib, pdfLibToBlob } from "./loader";
import { pagePercent, stageProgress, type ProgressFn } from "./progress";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export type OptimizeLevel = "low" | "medium" | "high";

/** Pages with under this many extracted characters are treated as scanned images. */
const SCANNED_PAGE_TEXT_THRESHOLD = 20;

export async function optimizePdf(
  file: File,
  level: OptimizeLevel = "medium",
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const { PDFDocument } = await loadPdfLibModule();
  const srcDoc = await loadPdfLib(file);
  const newDoc = await PDFDocument.create();

  const scaleMap = { low: 1.8, medium: 1.4, high: 1.0 };
  const qualityMap = { low: 0.82, medium: 0.72, high: 0.58 };
  const scale = scaleMap[level];
  const quality = qualityMap[level];

  onProgress?.(stageProgress("compress", 5, { pageCount: pdf.numPages }));

  for (let i = 1; i <= pdf.numPages; i++) {
    await yieldToMain();

    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const textLength = textContent.items.reduce(
      (n, item) => n + ("str" in item ? item.str.length : 0),
      0,
    );

    if (textLength >= SCANNED_PAGE_TEXT_THRESHOLD) {
      // Real text/vector content — copy losslessly so text stays selectable and searchable.
      const [copied] = await newDoc.copyPages(srcDoc, [i - 1]);
      newDoc.addPage(copied);
    } else {
      // Scanned/image-only page — safe to rasterize and recompress.
      const { canvas, width, height } = await renderPageToCanvas(pdf, i, scale);
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compress failed"))), "image/jpeg", quality);
      });
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const newPage = newDoc.addPage([width / scale, height / scale]);
      const img = await newDoc.embedJpg(jpegBytes);
      newPage.drawImage(img, { x: 0, y: 0, width: newPage.getWidth(), height: newPage.getHeight() });
    }

    onProgress?.(pagePercent(i, pdf.numPages, { stage: "compress" }));
  }

  onProgress?.(stageProgress("pack", 95));
  return pdfLibToBlob(newDoc);
}

export async function estimateOptimizedSize(file: File, level: OptimizeLevel): Promise<number> {
  const blob = await optimizePdf(file, level);
  return blob.size;
}
