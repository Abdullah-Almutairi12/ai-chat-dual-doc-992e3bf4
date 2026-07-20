import { groupIntoLines, joinLineItems, isRtlDominant, normalizeArabicText } from "./bidi";
import { pixelBoxToInches } from "./layout-fidelity";
import { loadPdfjs, renderPageToCanvas } from "./loader";
import { pdfToPptx } from "./pptx-export";
import { downloadBlob } from "./security";
import {
  loadDocxModule,
  loadXlsxModule,
  requireBrowser,
  resolveJsPdfConstructor,
} from "./runtime";

export type ConvertProgress = import("./progress").PdfProgress;

type ProgressFn = (p: ConvertProgress) => void;

/** PDF → DOCX with Adobe-style positioned text from layout engine. */
export async function pdfToDocx(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { extractLayout } = await import("@/lib/pdf-layout");
  const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } = await loadDocxModule();

  onProgress?.({ stage: "layout", percent: 5 });
  const layout = await extractLayout(file, (p) =>
    onProgress?.({
      stage: p.stage,
      percent: 5 + Math.round(p.percent * 0.7),
      page: p.page,
      pageCount: p.pageCount,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];
  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];
    for (const box of page.boxes) {
      const text = normalizeArabicText(box.text);
      if (!text) continue;
      const rtl = box.rtl || isRtlDominant(text);
      const pos = pixelBoxToInches(box, page.width, page.height);
      children.push(
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          indent: { left: Math.round(pos.x * 1440) },
          spacing: { before: Math.round(pos.y * 144), after: 40 },
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: rtl ? "Arial" : "Calibri",
              size: Math.round(pos.fontSize * 2),
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
    children.push(new Paragraph({ children: [new TextRun("PDF Quanta — exported document")] }));
  }

  onProgress?.({ stage: "pack", percent: 90 });
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

/** PDF → standalone HTML with bidi-correct layout. */
export async function pdfToHtml(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const { extractLayout, layoutToHtml } = await import("@/lib/pdf-layout");
  onProgress?.({ stage: "layout", percent: 10 });
  const layout = await extractLayout(file, (p) =>
    onProgress?.({ stage: p.stage, percent: 10 + Math.round(p.percent * 0.85) }),
  );
  const html = layoutToHtml(layout, file.name.replace(/\.\w+$/i, ""));
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

/** PDF → Excel (page text per row). */
export async function pdfToExcel(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const XLSX = await loadXlsxModule();
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
    onProgress?.({
      stage: "extract",
      percent: 10 + Math.round((i / pdf.numPages) * 80),
      page: i,
      pageCount: pdf.numPages,
    });
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pages");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export { pdfToPptx };

/** PDF → JPG/PNG images. */
export async function pdfToImages(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  onProgress?: ProgressFn,
): Promise<{ name: string; blob: Blob }[]> {
  requireBrowser();
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
    onProgress?.({
      stage: "render",
      percent: Math.round((i / pdf.numPages) * 100),
      page: i,
      pageCount: pdf.numPages,
    });
  }
  return results;
}

/** Images → PDF via jsPDF. */
export async function imagesToPdf(files: File[], onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const jsPDF = await resolveJsPdfConstructor();
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

/** Word/Excel → PDF (text-based fallback). */
export async function officeToPdf(file: File, onProgress?: ProgressFn): Promise<Blob> {
  requireBrowser();
  const jsPDF = await resolveJsPdfConstructor();
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength < 4) return "";

  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await loadXlsxModule();
    const wb = XLSX.read(bytes, { type: "array" });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
  }

  if (ext === "docx" || ext === "pptx") {
    const { unzipOfficeXmlText } = await import("@/lib/pdf/office-text");
    const xmlPath = ext === "docx" ? "word/document.xml" : "ppt/slides/slide1.xml";
    const text = await unzipOfficeXmlText(bytes, xmlPath);
    if (text) return text.slice(0, 50000);
  }

  if (ext === "doc" || ext === "ppt") {
    return "";
  }

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 50000);
  } catch {
    return "";
  }
}

function loadImage(url: string): Promise<{ data: string; width: number; height: number }> {
  requireBrowser();
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
  requireBrowser();
  switch (mode) {
    case "pdf-word":
      return { blob: await pdfToDocx(file, onProgress), ext: "docx" };
    case "pdf-excel":
      return { blob: await pdfToExcel(file, onProgress), ext: "xlsx" };
    case "pdf-ppt":
      return { blob: await pdfToPptx(file, onProgress), ext: "pptx" };
    case "pdf-html":
      return { blob: await pdfToHtml(file, onProgress), ext: "html" };
    case "pdf-jpg":
    case "pdf-png": {
      const fmt = mode === "pdf-png" ? "png" : "jpeg";
      return { blobs: await pdfToImages(file, fmt, onProgress), ext: fmt === "png" ? "png" : "jpg" };
    }
    case "images-pdf":
      return { blob: await imagesToPdf(extra?.imageFiles ?? [file], onProgress), ext: "pdf" };
    case "office-pdf":
      return { blob: await officeToPdf(file, onProgress), ext: "pdf" };
    default:
      throw new Error(`Unknown conversion mode: ${mode}`);
  }
}

export function saveConversionResult(
  result: { blob?: Blob; blobs?: { name: string; blob: Blob }[]; ext: string },
  baseName: string,
): void {
  if (typeof window === "undefined") return;
  if (result.blobs?.length) {
    for (const b of result.blobs) downloadBlob(b.blob, b.name);
    return;
  }
  if (result.blob) {
    downloadBlob(result.blob, `${baseName}.${result.ext}`);
  }
}
