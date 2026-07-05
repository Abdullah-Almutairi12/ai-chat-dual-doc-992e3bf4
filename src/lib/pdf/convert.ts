import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
  HeadingLevel,
} from "docx";
import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";

import { extractLayout, layoutToHtml } from "@/lib/pdf-layout";
import { groupIntoLines, joinLineItems, isRtlDominant, normalizeArabicText } from "./bidi";
import { loadPdfjs, loadPdfLib, pdfLibToBlob, renderPageToCanvas } from "./loader";
import { downloadBlob } from "./security";

export type ConvertProgress = { stage: string; percent: number; page?: number; pageCount?: number };

type ProgressFn = (p: ConvertProgress) => void;

/** PDF → DOCX with RTL-aware paragraphs from layout engine. */
export async function pdfToDocx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({ stage: "layout", percent: 5 });
  const layout = await extractLayout(file, (p) =>
    onProgress?.({
      stage: p.stage,
      percent: 5 + Math.round(p.percent * 0.7),
      page: p.page,
      pageCount: p.pageCount,
    }),
  );

  const children: Paragraph[] = [];
  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];
    const lines = groupIntoLines(
      page.boxes.map((b) => ({
        text: b.text,
        left: b.left,
        top: b.top,
        width: b.width,
        height: b.height,
      })),
    );
    for (const line of lines) {
      const text = normalizeArabicText(joinLineItems(line));
      if (!text) continue;
      const rtl = isRtlDominant(text);
      children.push(
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: rtl ? "Traditional Arabic" : "Calibri",
            }),
          ],
        }),
      );
    }
    if (i < layout.pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  if (!children.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PDF Quanta — exported document")],
      }),
    );
  }

  onProgress?.({ stage: "pack", percent: 90 });
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

/** PDF → standalone HTML with bidi-correct layout. */
export async function pdfToHtml(file: File, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({ stage: "layout", percent: 10 });
  const layout = await extractLayout(file, (p) =>
    onProgress?.({ stage: p.stage, percent: 10 + Math.round(p.percent * 0.85) }),
  );
  const html = layoutToHtml(layout, file.name.replace(/\.\w+$/i, ""));
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

/** PDF → Excel (page text per row). */
export async function pdfToExcel(file: File, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({ stage: "extract", percent: 10 });
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const rows: string[][] = [["Page", "Content"]];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) text += item.str + " ";
    }
    rows.push([String(i), normalizeArabicText(text.trim())]);
    onProgress?.({ stage: "extract", percent: 10 + Math.round((i / pdf.numPages) * 80), page: i, pageCount: pdf.numPages });
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pages");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** PDF → PowerPoint (one slide per page as image). */
export async function pdfToPptx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({ stage: "render", percent: 5 });
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  for (let i = 1; i <= pdf.numPages; i++) {
    const { canvas } = await renderPageToCanvas(pdf, i, 1.5);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
    onProgress?.({ stage: "render", percent: 5 + Math.round((i / pdf.numPages) * 90), page: i, pageCount: pdf.numPages });
  }

  const out = await pptx.write({ outputType: "blob" });
  return out as Blob;
}

/** PDF → JPG/PNG images (zip-like multi-download handled by caller). */
export async function pdfToImages(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  onProgress?: ProgressFn,
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const base = file.name.replace(/\.\w+$/i, "");
  const results: { name: string; blob: Blob }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const { canvas } = await renderPageToCanvas(pdf, i, 2);
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image export failed"))), mime, 0.92);
    });
    results.push({ name: `${base}-page-${i}.${format === "png" ? "png" : "jpg"}`, blob });
    onProgress?.({ stage: "render", percent: Math.round((i / pdf.numPages) * 100), page: i, pageCount: pdf.numPages });
  }
  return results;
}

/** Images → PDF via jsPDF. */
export async function imagesToPdf(files: File[], onProgress?: ProgressFn): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt" });
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / img.width, pageH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      if (i > 0) pdf.addPage();
      pdf.addImage(img.data, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    } finally {
      URL.revokeObjectURL(url);
    }
    onProgress?.({ stage: "compose", percent: Math.round(((i + 1) / files.length) * 100) });
  }
  return pdf.output("blob");
}

/** Word/Excel → PDF (render as text pages — full fidelity requires server LibreOffice). */
export async function officeToPdf(file: File, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({ stage: "read", percent: 20 });
  const text = await extractOfficeText(file);
  const pdf = new jsPDF();
  const rtl = isRtlDominant(text);
  pdf.setFont("helvetica");
  const lines = pdf.splitTextToSize(text.slice(0, 12000), 180);
  let y = 20;
  for (const line of lines) {
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, rtl ? 190 : 14, y, { align: rtl ? "right" : "left" });
    y += 7;
  }
  onProgress?.({ stage: "done", percent: 100 });
  return pdf.output("blob");
}

async function extractOfficeText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
  }
  return (await file.text()).slice(0, 50000);
}

function loadImage(url: string): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve({ data: canvas.toDataURL("image/jpeg", 0.92), width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function runConversion(
  mode: string,
  file: File,
  extra?: { imageFiles?: File[]; imageFormat?: "jpeg" | "png" },
  onProgress?: ProgressFn,
): Promise<{ blob?: Blob; blobs?: { name: string; blob: Blob }[]; ext: string }> {
  switch (mode) {
    case "pdf-word": {
      const blob = await pdfToDocx(file, onProgress);
      return { blob, ext: "docx" };
    }
    case "pdf-excel": {
      const blob = await pdfToExcel(file, onProgress);
      return { blob, ext: "xlsx" };
    }
    case "pdf-ppt": {
      const blob = await pdfToPptx(file, onProgress);
      return { blob, ext: "pptx" };
    }
    case "pdf-html": {
      const blob = await pdfToHtml(file, onProgress);
      return { blob, ext: "html" };
    }
    case "pdf-jpg":
    case "pdf-png": {
      const fmt = mode === "pdf-png" ? "png" : "jpeg";
      const blobs = await pdfToImages(file, fmt, onProgress);
      return { blobs, ext: fmt === "png" ? "png" : "jpg" };
    }
    case "images-pdf": {
      const blob = await imagesToPdf(extra?.imageFiles ?? [file], onProgress);
      return { blob, ext: "pdf" };
    }
    case "office-pdf": {
      const blob = await officeToPdf(file, onProgress);
      return { blob, ext: "pdf" };
    }
    default:
      throw new Error(`Unknown conversion mode: ${mode}`);
  }
}

export function saveConversionResult(
  result: { blob?: Blob; blobs?: { name: string; blob: Blob }[]; ext: string },
  baseName: string,
): void {
  if (result.blobs?.length) {
    for (const b of result.blobs) downloadBlob(b.blob, b.name);
    return;
  }
  if (result.blob) {
    downloadBlob(result.blob, `${baseName}.${result.ext}`);
  }
}
