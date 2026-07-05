import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { loadPdfLib, pdfLibToBlob } from "./loader";

export type AnnotationType = "highlight" | "text" | "rectangle" | "redact";

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

export async function applyAnnotations(file: File, annotations: Annotation[]): Promise<Blob> {
  const doc = await loadPdfLib(file);
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
      case "redact":
        page.drawRectangle({
          x: ann.x,
          y,
          width: ann.width ?? 120,
          height: ann.height ?? 16,
          color: rgb(0, 0, 0),
          opacity: 1,
        });
        break;
    }
  }
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

export async function redactRegions(
  file: File,
  regions: { page: number; x: number; y: number; width: number; height: number }[],
): Promise<Blob> {
  return applyAnnotations(
    file,
    regions.map((r) => ({
      type: "redact" as const,
      page: r.page,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    })),
  );
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
  const doc = await loadPdfLib(file);
  const page = doc.getPage(pageNum - 1);
  const img = await doc.embedPng(imageBytes).catch(() => doc.embedJpg(imageBytes));
  const { height } = page.getSize();
  page.drawImage(img, { x, y: height - y - h, width: w, height: h });
  return pdfLibToBlob(doc);
}
