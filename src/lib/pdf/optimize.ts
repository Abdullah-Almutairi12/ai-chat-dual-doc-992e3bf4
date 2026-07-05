import { loadPdfLib, pdfLibToBlob } from "./loader";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export type OptimizeLevel = "low" | "medium" | "high";

export async function optimizePdf(file: File, level: OptimizeLevel = "medium"): Promise<Blob> {
  requireBrowser();
  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const { PDFDocument } = await loadPdfLibModule();
  const newDoc = await PDFDocument.create();

  const scaleMap = { low: 1.8, medium: 1.4, high: 1.0 };
  const qualityMap = { low: 0.82, medium: 0.72, high: 0.58 };
  const scale = scaleMap[level];
  const quality = qualityMap[level];

  for (let i = 1; i <= pdf.numPages; i++) {
    const { canvas, width, height } = await renderPageToCanvas(pdf, i, scale);
    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compress failed"))), "image/jpeg", quality);
    });
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const page = newDoc.addPage([width / scale, height / scale]);
    const img = await newDoc.embedJpg(jpegBytes);
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }

  return pdfLibToBlob(newDoc);
}

export async function estimateOptimizedSize(file: File, level: OptimizeLevel): Promise<number> {
  const blob = await optimizePdf(file, level);
  return blob.size;
}
