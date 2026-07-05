import { PDFDocument } from "pdf-lib";

import { loadPdfLib, pdfLibToBlob } from "./loader";

export type SignatureOptions = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** PNG/JPG bytes of drawn, typed, or uploaded signature */
  imageBytes: Uint8Array;
  label?: string;
};

export async function applySignatures(file: File, signatures: SignatureOptions[]): Promise<Blob> {
  const doc = await loadPdfLib(file);
  for (const sig of signatures) {
    const page = doc.getPage(sig.page - 1);
    if (!page) continue;
    const img = await doc.embedPng(sig.imageBytes).catch(() => doc.embedJpg(sig.imageBytes));
    const { height } = page.getSize();
    page.drawImage(img, {
      x: sig.x,
      y: height - sig.y - sig.height,
      width: sig.width,
      height: sig.height,
    });
    if (sig.label) {
      page.drawText(sig.label, {
        x: sig.x,
        y: height - sig.y - sig.height - 12,
        size: 8,
      });
    }
  }
  return pdfLibToBlob(doc);
}

/** Render typed signature to PNG bytes via canvas. */
export function typedSignatureToBytes(text: string, fontFamily = "Segoe Script"): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";
  ctx.font = `32px "${fontFamily}", cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const data = canvas.toDataURL("image/png").split(",")[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function drawSignatureToBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Signature export failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function stampOrganizationalSeal(
  file: File,
  page: number,
  sealBytes: Uint8Array,
  x: number,
  y: number,
  size = 80,
): Promise<Blob> {
  return applySignatures(file, [{ page, x, y, width: size, height: size, imageBytes: sealBytes, label: "Official Stamp" }]);
}
