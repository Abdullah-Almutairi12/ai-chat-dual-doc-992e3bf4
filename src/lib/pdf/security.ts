/** Client-side upload validation — prevents oversized or malicious file types. */

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const PDF_MIME = new Set(["application/pdf"]);
const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);
const OFFICE_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const SAFE_NAME = /^[\w\u0600-\u06FF\s.\-()]+$/;

export type UploadKind = "pdf" | "image" | "office" | "any";

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").slice(0, 200);
  return base || "document.pdf";
}

function ext(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

export function detectKind(file: File): UploadKind {
  if (PDF_MIME.has(file.type) || ext(file.name) === "pdf") return "pdf";
  if (IMAGE_MIME.has(file.type) || /^(png|jpe?g|webp|gif|bmp)$/i.test(ext(file.name))) return "image";
  if (OFFICE_MIME.has(file.type) || /^(docx?|xlsx?|pptx?)$/i.test(ext(file.name))) return "office";
  return "any";
}

export function validateUpload(
  file: File,
  opts: { kind?: UploadKind; maxBytes?: number } = {},
): { ok: true } | { ok: false; reason: "size" | "type" | "name" } {
  const max = opts.maxBytes ?? MAX_FILE_BYTES;
  if (file.size <= 0 || file.size > max) return { ok: false, reason: "size" };
  if (!SAFE_NAME.test(file.name.replace(/[^\w\u0600-\u06FF\s.\-()]/g, ""))) {
    return { ok: false, reason: "name" };
  }
  const kind = detectKind(file);
  const allowed = opts.kind ?? "any";
  if (allowed === "pdf" && kind !== "pdf") return { ok: false, reason: "type" };
  if (allowed === "image" && kind !== "image") return { ok: false, reason: "type" };
  if (allowed === "office" && kind !== "office") return { ok: false, reason: "type" };
  if (allowed === "any" && kind === "any") return { ok: false, reason: "type" };
  return { ok: true };
}

/** Escape user text before injecting into HTML (XSS prevention). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFileName(fileName);
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
