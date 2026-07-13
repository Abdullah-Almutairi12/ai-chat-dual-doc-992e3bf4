import { validateOfficeBlob } from "@/lib/pdf/office-zip";

export type OutputFormat = "pdf" | "docx" | "pptx" | "xlsx" | "html" | "jpg" | "jpeg" | "png";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const MIN_BYTES = 512;

function headBytes(blob: Blob, n = 8): Promise<Uint8Array> {
  return blob.slice(0, n).arrayBuffer().then((b) => new Uint8Array(b));
}

function isZip(h: Uint8Array): boolean {
  return ZIP_MAGIC.every((b, i) => h[i] === b);
}

function isPdf(h: Uint8Array): boolean {
  return h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46; // %PDF
}

function isJpeg(h: Uint8Array): boolean {
  return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
}

function isPng(h: Uint8Array): boolean {
  return h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
}

export function formatFromFileName(name: string): OutputFormat {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return "pdf";
}

/** Inspect blob magic bytes — rejects empty or corrupted outputs before download. */
export async function validateOutputBlob(blob: Blob, format: OutputFormat): Promise<boolean> {
  if (!blob?.size) return false;
  if (format !== "html" && blob.size < MIN_BYTES) return false;
  const h = await headBytes(blob, 8);

  switch (format) {
    case "pdf":
      return isPdf(h);
    case "docx":
    case "pptx":
    case "xlsx":
      if (!isZip(h) || blob.size < MIN_BYTES) return false;
      return validateOfficeBlob(blob, format);
    case "jpg":
    case "jpeg":
      return isJpeg(h);
    case "png":
      return isPng(h);
    case "html": {
      const text = await blob.slice(0, Math.min(512, blob.size)).text();
      return /<!DOCTYPE|<html/i.test(text) && blob.size >= 32;
    }
    default:
      return blob.size >= MIN_BYTES;
  }
}

/** Returns the blob if valid, otherwise null (caller should retry fallback). */
export async function ensureValidOutput(blob: Blob, format: OutputFormat): Promise<Blob | null> {
  const ok = await validateOutputBlob(blob, format);
  if (!ok) {
    console.warn("[validate-output] rejected output", { format, bytes: blob?.size ?? 0 });
    return null;
  }
  return blob;
}
