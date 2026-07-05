import { loadPdfLibModule, requireBrowser } from "./runtime";
import { loadPdfLib, pdfLibToBlob, readPdfBytes } from "./loader";

export async function mergePdfs(files: File[]): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const merged = await PDFDocument.create();
  for (const file of files) {
    const bytes = await readPdfBytes(file);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return pdfLibToBlob(merged);
}

export async function splitPdf(file: File, ranges: { start: number; end: number }[]): Promise<Blob[]> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  const total = src.getPageCount();
  const out: Blob[] = [];

  for (const range of ranges) {
    const doc = await PDFDocument.create();
    const start = Math.max(1, range.start) - 1;
    const end = Math.min(total, range.end) - 1;
    const indices = [];
    for (let i = start; i <= end; i++) indices.push(i);
    const pages = await doc.copyPages(src, indices);
    pages.forEach((p) => doc.addPage(p));
    out.push(await pdfLibToBlob(doc));
  }
  return out;
}

export async function splitEveryPage(file: File): Promise<Blob[]> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  const total = src.getPageCount();
  const out: Blob[] = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    out.push(await pdfLibToBlob(doc));
  }
  return out;
}

export async function deletePages(file: File, pageNumbers: number[]): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const doc = await loadPdfLib(file);
  const toRemove = new Set(pageNumbers.map((n) => n - 1));
  const indices = doc.getPageIndices().filter((i) => !toRemove.has(i));
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(doc, indices);
  pages.forEach((p) => newDoc.addPage(p));
  return pdfLibToBlob(newDoc);
}

export async function rotatePages(file: File, pageNumbers: number[], angle: 90 | 180 | 270): Promise<Blob> {
  requireBrowser();
  const { degrees } = await loadPdfLibModule();
  const doc = await loadPdfLib(file);
  const targets = pageNumbers.length ? pageNumbers.map((n) => n - 1) : doc.getPageIndices();
  for (const idx of targets) {
    const page = doc.getPage(idx);
    if (!page) continue;
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + angle));
  }
  return pdfLibToBlob(doc);
}

export async function reorderPages(file: File, order: number[]): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  const newDoc = await PDFDocument.create();
  const indices = order.map((n) => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach((p) => newDoc.addPage(p));
  return pdfLibToBlob(newDoc);
}

export type PageThumb = { page: number; dataUrl: string; width: number; height: number };

export async function getPageThumbnails(file: File, maxPages = 40): Promise<PageThumb[]> {
  requireBrowser();
  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const count = Math.min(pdf.numPages, maxPages);
  const thumbs: PageThumb[] = [];
  for (let i = 1; i <= count; i++) {
    const { canvas, width, height } = await renderPageToCanvas(pdf, i, 0.35);
    thumbs.push({ page: i, dataUrl: canvas.toDataURL("image/jpeg", 0.7), width, height });
  }
  return thumbs;
}
