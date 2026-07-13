import type { ProgressFn } from "@/lib/pdf/progress";
import { clampPercent } from "@/lib/pdf/progress";
import type { OutputFormat } from "@/lib/pdf/validate-output";
import { validateOutputBlob } from "@/lib/pdf/validate-output";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

/** Smooth progress while waiting on a long network/server call (prevents UI freeze at 8%). */
export function startProgressHeartbeat(
  onProgress: ProgressFn | undefined,
  stage: string,
  fromPercent: number,
  toPercent: number,
  durationMs: number,
): () => void {
  if (!onProgress) return () => {};
  const start = Date.now();
  onProgress({ stage, percent: clampPercent(fromPercent) });
  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    const t = Math.min(1, elapsed / durationMs);
    onProgress({ stage, percent: clampPercent(fromPercent + (toPercent - fromPercent) * t) });
  }, 750);
  return () => clearInterval(timer);
}

/** Read fetch body as ArrayBuffer with an upper bound to avoid memory blowups. */
export async function readBoundedArrayBuffer(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  const lenHeader = response.headers.get("content-length");
  if (lenHeader) {
    const declared = Number(lenHeader);
    if (Number.isFinite(declared) && declared > maxBytes) return null;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0 || buffer.byteLength > maxBytes) return null;
  return buffer;
}

export async function arrayBufferToValidatedBlob(
  buffer: ArrayBuffer,
  mimeType: string,
  format: OutputFormat,
): Promise<Blob | null> {
  const blob = new Blob([buffer], { type: mimeType || "application/octet-stream" });
  const ok = await validateOutputBlob(blob, format);
  return ok ? blob : null;
}

export function quickZipHeaderCheck(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 512) return false;
  const h = new Uint8Array(buffer, 0, 4);
  return ZIP_MAGIC.every((b, i) => h[i] === b);
}

export function mimeForToolExt(ext: string): string {
  switch (ext) {
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "html":
      return "text/html;charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
