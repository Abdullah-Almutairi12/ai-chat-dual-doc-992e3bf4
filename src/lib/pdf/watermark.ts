import { yieldToMain } from "./batch";
import { loadPdfLib, pdfLibToBlob } from "./loader";
import { pagePercent, type ProgressFn } from "./progress";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export type WatermarkOptions = {
  text?: string;
  imageBytes?: Uint8Array;
  opacity?: number;
  rotation?: number;
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  fontSize?: number;
};

export async function addWatermark(
  file: File,
  opts: WatermarkOptions,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  const { rgb, degrees } = await loadPdfLibModule();
  const doc = await loadPdfLib(file);
  const opacity = opts.opacity ?? 0.3;
  const rotation = opts.rotation ?? -30;
  const pages = doc.getPages();
  const pageCount = pages.length;

  for (let i = 0; i < pages.length; i++) {
    await yieldToMain();
    const page = pages[i];
    const { width, height } = page.getSize();
    if (opts.imageBytes) {
      const img = await doc.embedPng(opts.imageBytes).catch(() => doc.embedJpg(opts.imageBytes!));
      const dims = img.scale(0.4);
      const x = (width - dims.width) / 2;
      const y = (height - dims.height) / 2;
      page.drawImage(img, { x, y, width: dims.width, height: dims.height, opacity, rotate: degrees(rotation) });
    } else if (opts.text) {
      const fontSize = opts.fontSize ?? Math.min(width, height) * 0.08;
      const text = opts.text;
      const textWidth = text.length * fontSize * 0.45;
      let x = (width - textWidth) / 2;
      let y = height / 2;
      switch (opts.position) {
        case "top-left":
          x = 40;
          y = height - 60;
          break;
        case "top-right":
          x = width - textWidth - 40;
          y = height - 60;
          break;
        case "bottom-left":
          x = 40;
          y = 40;
          break;
        case "bottom-right":
          x = width - textWidth - 40;
          y = 40;
          break;
      }
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
        rotate: degrees(rotation),
      });
    }
    onProgress?.(pagePercent(i + 1, pageCount, { stage: "watermark" }));
  }
  return pdfLibToBlob(doc);
}

export async function removeWatermark(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const newDoc = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    await yieldToMain();
    const { canvas } = await renderPageToCanvas(pdf, i, 2);
    cleanWatermarkArtifacts(canvas);
    const pngBytes = await canvasToPng(canvas);
    const page = newDoc.addPage([canvas.width / 2, canvas.height / 2]);
    const img = await newDoc.embedPng(pngBytes);
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    onProgress?.(pagePercent(i, pdf.numPages, { stage: "scan" }));
  }
  return pdfLibToBlob(newDoc);
}

function cleanWatermarkArtifacts(canvas: HTMLCanvasElement): void {
  if (typeof document === "undefined") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const grey = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (grey > 180 && grey < 240 && spread < 30) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}
