import type { MasterConvertTool } from "@/lib/pdf/vision/schema";
import { OFFICE_MIME } from "@/lib/pdf/vision/layout-constants";

/** Copy exact bytes for fetch Response — avoids Node pooled-Buffer over-read corruption. */
export function normalizeOfficeBuffer(buf: Buffer): Uint8Array {
  return Uint8Array.from(buf);
}

/** Ensure builder output is a tight byte copy (no shared pool slack). */
export function finalizeOfficeBuffer(buf: Buffer): Buffer {
  return Buffer.from(buf);
}

const OFFICE_MIME_SET = new Set<string>([
  OFFICE_MIME.docx,
  OFFICE_MIME.pptx,
  OFFICE_MIME.xlsx,
]);

export function mimeForMasterTool(tool: MasterConvertTool): string {
  switch (tool) {
    case "pdf-word":
      return OFFICE_MIME.docx;
    case "pdf-ppt":
      return OFFICE_MIME.pptx;
    case "pdf-excel":
      return OFFICE_MIME.xlsx;
    case "pdf-html":
      return OFFICE_MIME.html;
  }
}

function asciiFallbackName(name: string): string {
  const base = name.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return base.length ? base : "document";
}

export type OfficeFileResponseMeta = {
  provider: string;
  model: string;
  preferredProvider: string;
  usedProviderFallback: boolean;
  pageCount: number;
};

/** Build a binary Response with headers Office/Windows expect for ZIP-based formats. */
export function officeFileResponse(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  meta: OfficeFileResponseMeta,
): Response {
  const body = normalizeOfficeBuffer(buffer);

  if (body.byteLength < 512) {
    throw new Error(`Office output too small (${body.byteLength} bytes)`);
  }

  if (OFFICE_MIME_SET.has(mimeType)) {
    const zipOk = body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
    if (!zipOk) {
      throw new Error("Office output is not a valid ZIP archive");
    }
  }

  const asciiName = asciiFallbackName(fileName);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "x-vision-provider": meta.provider,
      "x-vision-model": meta.model,
      "x-vision-preferred": meta.preferredProvider,
      "x-vision-fallback": meta.usedProviderFallback ? "true" : "false",
      "x-vision-pages": String(meta.pageCount),
      "x-master-engine": "true",
    },
  });
}
