import { yieldToMain } from "./batch";
import { loadPdfLib, pdfLibToBlob, readPdfBytes } from "./loader";
import { batchFilePercent, clampPercent, type ProgressFn, pagePercent } from "./progress";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export async function mergePdfs(files: File[], onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const merged = await PDFDocument.create();
  const fileCount = files.length;

  onProgress?.({ stage: "merge", percent: 5, fileCount, fileIndex: 0 });

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    await yieldToMain();
    const bytes = await readPdfBytes(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const indices = doc.getPageIndices();
    const pageCount = indices.length;

    for (let pi = 0; pi < indices.length; pi++) {
      const [page] = await merged.copyPages(doc, [indices[pi]]);
      merged.addPage(page);
      if (pi % 3 === 0) await yieldToMain();
      const inner = pageCount > 0 ? ((pi + 1) / pageCount) * 100 : 100;
      onProgress?.({
        stage: "merge",
        percent: batchFilePercent(fi, fileCount, inner),
        fileIndex: fi + 1,
        fileCount,
        page: pi + 1,
        pageCount,
      });
    }
  }

  onProgress?.({ stage: "pack", percent: 95, fileCount });
  return pdfLibToBlob(merged);
}

export async function splitPdf(
  file: File,
  ranges: { start: number; end: number }[],
  onProgress?: ProgressFn,
): Promise<Blob[]> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  const total = src.getPageCount();
  const out: Blob[] = [];

  for (let ri = 0; ri < ranges.length; ri++) {
    await yieldToMain();
    const range = ranges[ri];
    const doc = await PDFDocument.create();
    const start = Math.max(1, range.start) - 1;
    const end = Math.min(total, range.end) - 1;
    const indices: number[] = [];
    for (let i = start; i <= end; i++) indices.push(i);
    const pages = await doc.copyPages(src, indices);
    pages.forEach((p) => doc.addPage(p));
    out.push(await pdfLibToBlob(doc));
    onProgress?.({
      stage: "split",
      percent: clampPercent(((ri + 1) / ranges.length) * 100),
      page: ri + 1,
      pageCount: ranges.length,
    });
  }
  return out;
}

export async function splitEveryPage(file: File, onProgress?: ProgressFn): Promise<Blob[]> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  const total = src.getPageCount();
  const out: Blob[] = [];

  for (let i = 0; i < total; i++) {
    await yieldToMain();
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    out.push(await pdfLibToBlob(doc));
    onProgress?.(pagePercent(i + 1, total, { stage: "split" }));
  }
  return out;
}

export async function deletePages(file: File, pageNumbers: number[], onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const doc = await loadPdfLib(file);
  onProgress?.({ stage: "delete", percent: 20 });
  const toRemove = new Set(pageNumbers.map((n) => n - 1));
  const indices = doc.getPageIndices().filter((i) => !toRemove.has(i));
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(doc, indices);
  pages.forEach((p) => newDoc.addPage(p));
  onProgress?.({ stage: "pack", percent: 90 });
  return pdfLibToBlob(newDoc);
}

export async function rotatePages(
  file: File,
  pageNumbers: number[],
  angle: 90 | 180 | 270,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  const { degrees } = await loadPdfLibModule();
  const doc = await loadPdfLib(file);
  const targets = pageNumbers.length ? pageNumbers.map((n) => n - 1) : doc.getPageIndices();
  for (let ti = 0; ti < targets.length; ti++) {
    const idx = targets[ti];
    const page = doc.getPage(idx);
    if (!page) continue;
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + angle));
    if (ti % 5 === 0) await yieldToMain();
    onProgress?.(pagePercent(ti + 1, targets.length, { stage: "rotate" }));
  }
  return pdfLibToBlob(doc);
}

export async function reorderPages(file: File, order: number[], onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadPdfLibModule();
  const src = await loadPdfLib(file);
  onProgress?.({ stage: "reorder", percent: 30 });
  const newDoc = await PDFDocument.create();
  const indices = order.map((n) => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach((p) => newDoc.addPage(p));
  onProgress?.({ stage: "pack", percent: 90 });
  return pdfLibToBlob(newDoc);
}

export type PageThumb = { page: number; dataUrl: string; width: number; height: number };

export async function getPageThumbnails(file: File, maxPages = 40, onProgress?: ProgressFn): Promise<PageThumb[]> {
  requireBrowser();
  const { loadPdfjs, renderPageToCanvas } = await import("./loader");
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const count = Math.min(pdf.numPages, maxPages);
  const thumbs: PageThumb[] = [];
  for (let i = 1; i <= count; i++) {
    await yieldToMain();
    const { canvas, width, height } = await renderPageToCanvas(pdf, i, 0.35);
    thumbs.push({ page: i, dataUrl: canvas.toDataURL("image/jpeg", 0.7), width, height });
    onProgress?.(pagePercent(i, count, { stage: "thumb" }));
  }
  return thumbs;
}
