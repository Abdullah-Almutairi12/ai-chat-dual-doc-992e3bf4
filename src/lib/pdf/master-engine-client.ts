import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

import {
  arrayBufferToValidatedBlob,
  mimeForToolExt,
  quickZipHeaderCheck,
  readBoundedArrayBuffer,
  startProgressHeartbeat,
} from "@/lib/pdf/binary-response";
import type { PdfProgress } from "@/lib/pdf/progress";
import { formatFromFileName } from "@/lib/pdf/validate-output";
import type { FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import {
  extForMasterTool,
  isMasterPdfTool,
  MAX_VISION_PAGES,
  VISION_CHUNK_PAGES,
  type MasterConvertTool,
  type VisionPage,
} from "@/lib/pdf/vision/schema";
import {
  MASTER_CLIENT_UPLOAD_LIMIT_BYTES,
  MASTER_FETCH_TIMEOUT_MS,
  MASTER_SERVER_PROCESS_LIMIT_BYTES,
  masterSkipReason,
} from "@/lib/pdf/vision/upload-limits";

export type { MasterConvertTool };
export { isMasterPdfTool };

export type MasterConversionMeta = {
  source: "master" | "client";
  usedFallback: boolean;
  skipReason?: string;
};

export function isVisionConvertTool(mode: string): mode is MasterConvertTool {
  return isMasterPdfTool(mode);
}

async function countPdfPages(file: File): Promise<number> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    return Math.min(pdf.numPages, MAX_VISION_PAGES);
  } catch {
    return MAX_VISION_PAGES;
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function shouldUseChunkedPipeline(file: File, pageCount: number): boolean {
  return file.size > MASTER_CLIENT_UPLOAD_LIMIT_BYTES || pageCount > 3;
}

/** In-memory chunked Vision AI — sends PDF base64 per chunk, no storage. */
async function convertViaChunkedPipeline(
  file: File,
  tool: MasterConvertTool,
  pdfBase64: string,
  pageCount: number,
  token: string,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const allPages: VisionPage[] = [];
  const allRenders: FidelityPageRender[] = [];
  let provider = "openai";
  let model = "";

  for (let start = 1; start <= pageCount; start += VISION_CHUNK_PAGES) {
    const end = Math.min(start + VISION_CHUNK_PAGES - 1, pageCount);
    onProgress?.({
      stage: "master-vision",
      percent: 12 + Math.round(((start - 1) / pageCount) * 72),
      page: start,
      pageCount,
    });

    const res = await fetch("/api/pdf/convert-chunk", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pdfBase64, tool, pageStart: start, pageEnd: end }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      pages?: VisionPage[];
      renders?: FidelityPageRender[];
      provider?: string;
      model?: string;
      error?: string;
    };

    if (!res.ok || !data.ok || !data.pages?.length) {
      console.info("[master-engine] chunk failed", start, end, data.error ?? res.status);
      return null;
    }

    allPages.push(...data.pages);
    if (data.renders?.length) allRenders.push(...data.renders);
    provider = data.provider ?? provider;
    model = data.model ?? model;
  }

  onProgress?.({ stage: "master-build", percent: 88, pageCount });

  const buildRes = await fetch("/api/pdf/convert-build", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tool,
      fileName: file.name,
      pages: allPages,
      renders: allRenders,
      provider,
      model,
    }),
  });

  if (!buildRes.ok) return null;

  const contentType = buildRes.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return null;

  const ext = extForMasterTool(tool);
  const buffer = await readBoundedArrayBuffer(buildRes, 32 * 1024 * 1024);
  if (!buffer) return null;

  const format = formatFromFileName(`output.${ext}`);
  if ((format === "docx" || format === "pptx" || format === "xlsx") && !quickZipHeaderCheck(buffer)) return null;

  const blob = await arrayBufferToValidatedBlob(buffer, mimeForToolExt(ext), format);
  if (!blob) return null;

  onProgress?.({ stage: "done", percent: 100 });
  return { blob, ext };
}

async function convertViaDirectUpload(
  file: File,
  tool: MasterConvertTool,
  token: string,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("tool", tool);

  onProgress?.({ stage: "master-upload", percent: 8 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MASTER_FETCH_TIMEOUT_MS);
  const stopHeartbeat = startProgressHeartbeat(onProgress, "master-upload", 8, 45, MASTER_FETCH_TIMEOUT_MS - 2000);

  try {
    const res = await fetch("/api/pdf/convert-vision", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    stopHeartbeat();

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) return null;

    onProgress?.({ stage: "master-download", percent: 88 });
    const ext = extForMasterTool(tool);
    const buffer = await readBoundedArrayBuffer(res, 32 * 1024 * 1024);
    if (!buffer) return null;

    const format = formatFromFileName(`output.${ext}`);
    if ((format === "docx" || format === "pptx" || format === "xlsx") && !quickZipHeaderCheck(buffer)) return null;

    const blob = await arrayBufferToValidatedBlob(buffer, mimeForToolExt(ext), format);
    if (!blob) return null;

    onProgress?.({ stage: "done", percent: 100 });
    return { blob, ext };
  } finally {
    stopHeartbeat();
    clearTimeout(timer);
  }
}

export async function convertViaMasterEngine(
  file: File,
  tool: MasterConvertTool,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const skip = masterSkipReason(file);
  if (skip === "empty_file") return null;
  if (file.size > MASTER_SERVER_PROCESS_LIMIT_BYTES) return null;
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return null;

    const pageCount = await countPdfPages(file);

    if (shouldUseChunkedPipeline(file, pageCount)) {
      onProgress?.({ stage: "master-prepare", percent: 6 });
      const pdfBase64 = await fileToBase64(file);
      return convertViaChunkedPipeline(file, tool, pdfBase64, pageCount, token, onProgress);
    }

    return convertViaDirectUpload(file, tool, token, onProgress);
  } catch (err) {
    console.info("[master-engine] error", err instanceof Error ? err.message : err);
    return null;
  }
}

export const convertViaVisionApi = convertViaMasterEngine;

export async function runMasterConversion(
  mode: string,
  file: File,
  extra?: { imageFiles?: File[]; imageFormat?: "jpeg" | "png" },
  onProgress?: (p: PdfProgress) => void,
): Promise<{ blob?: Blob; blobs?: { name: string; blob: Blob }[]; ext: string; meta: MasterConversionMeta }> {
  if (isMasterPdfTool(mode) && file.size <= MASTER_SERVER_PROCESS_LIMIT_BYTES) {
    const master = await convertViaMasterEngine(file, mode, onProgress);
    if (master) {
      return { blob: master.blob, ext: master.ext, meta: { source: "master", usedFallback: false } };
    }
    onProgress?.({ stage: "client-fallback", percent: 12 });
  } else if (isMasterPdfTool(mode)) {
    onProgress?.({ stage: "client-local", percent: 12 });
  }

  const { runConversion } = await import("@/lib/pdf/convert");
  const result = await runConversion(mode, file, extra, onProgress);
  return {
    ...result,
    meta: {
      source: "client",
      usedFallback: isMasterPdfTool(mode),
      skipReason: isMasterPdfTool(mode) ? masterSkipReason(file) ?? undefined : undefined,
    },
  };
}
