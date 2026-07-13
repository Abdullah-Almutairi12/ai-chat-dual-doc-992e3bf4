import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFDocument } from "pdf-lib";

import { loadPdfLibModule, requireBrowser } from "./runtime";

/** @deprecated Use PDFDocumentProxy from pdfjs-dist at call sites. */
export type PdfjsDocument = PDFDocumentProxy;

export async function loadPdfjs() {
  requireBrowser();
  const { loadPdfjsWithWorker } = await import("./pdfjs-worker");
  return loadPdfjsWithWorker();
}

export async function readPdfBytes(file: File | Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return bytes;
  }
  throw new Error("Invalid or corrupt PDF file");
}

export async function loadPdfLib(file: File | Blob): Promise<PDFDocument> {
  const { PDFDocument } = await loadPdfLibModule();
  const bytes = await readPdfBytes(file);
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

export async function pdfLibToBlob(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

export async function renderPageToCanvas(
  pdfjsDoc: PDFDocumentProxy,
  pageNum: number,
  scale = 2,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  requireBrowser();
  const page = await pdfjsDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height };
}
