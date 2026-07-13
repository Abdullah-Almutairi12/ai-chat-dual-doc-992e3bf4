import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { STORAGE_BUCKETS } from "@/integrations/supabase/storage-buckets";

import {
  arrayBufferToValidatedBlob,
  mimeForToolExt,
  quickZipHeaderCheck,
  readBoundedArrayBuffer,
  startProgressHeartbeat,
} from "@/lib/pdf/binary-response";
import type { PdfProgress } from "@/lib/pdf/progress";
import { uploadFileViaApi } from "@/lib/pdf-storage";
import { formatFromFileName } from "@/lib/pdf/validate-output";
import {
  MASTER_CLIENT_UPLOAD_LIMIT_BYTES,
  MASTER_FETCH_TIMEOUT_MS,
  MASTER_SERVER_PROCESS_LIMIT_BYTES,
  masterSkipReason,
} from "@/lib/pdf/vision/upload-limits";
import { extForMasterTool, isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";

export type { MasterConvertTool };
export { isMasterPdfTool };

export type MasterConversionMeta = {
  source: "master" | "client";
  usedFallback: boolean;
  skipReason?: string;
};

/** @deprecated Use isMasterPdfTool */
export function isVisionConvertTool(mode: string): mode is MasterConvertTool {
  return isMasterPdfTool(mode);
}

/**
 * Attempt server-side Master Engine conversion (direct upload or Supabase storage for large PDFs).
 * Returns null when server path is unsuitable so caller uses the client engine.
 */
export async function convertViaMasterEngine(
  file: File,
  tool: MasterConvertTool,
  onProgress?: (p: PdfProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const skip = masterSkipReason(file);
  if (skip === "empty_file") {
    console.info("[master-engine] skipping server path:", skip);
    return null;
  }
  if (file.size > MASTER_SERVER_PROCESS_LIMIT_BYTES) {
    console.info("[master-engine] file exceeds server process limit");
    return null;
  }

  if (!isSupabaseConfigured()) {
    console.info("[master-engine] supabase not configured — using client engine");
    return null;
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      console.info("[master-engine] no session — using client engine");
      return null;
    }

    const form = new FormData();
    form.append("tool", tool);

    onProgress?.({ stage: "master-upload", percent: 8 });

    if (file.size > MASTER_CLIENT_UPLOAD_LIMIT_BYTES) {
      onProgress?.({ stage: "master-storage", percent: 10 });
      const uploaded = await uploadFileViaApi(file, {
        bucket: STORAGE_BUCKETS.pdfTools,
        toolId: tool.replace("pdf-", ""),
      });
      if (!uploaded) {
        console.info("[master-engine] storage upload failed — using client engine");
        return null;
      }
      form.append("storageBucket", uploaded.bucket);
      form.append("storagePath", uploaded.path);
      form.append("fileName", file.name);
    } else {
      form.append("file", file);
    }

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

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.info("[master-engine] server error, using client engine", res.status, detail.slice(0, 200));
        return null;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        console.info("[master-engine] JSON response instead of binary — using client engine");
        return null;
      }

      onProgress?.({ stage: "master-download", percent: 88 });

      const ext = extForMasterTool(tool);
      const maxBytes = 32 * 1024 * 1024;
      const buffer = await readBoundedArrayBuffer(res, maxBytes);
      if (!buffer) {
        console.info("[master-engine] empty/oversized response — using client engine");
        return null;
      }

      const format = formatFromFileName(`output.${ext}`);
      if (format === "docx" || format === "pptx" || format === "xlsx") {
        if (!quickZipHeaderCheck(buffer)) {
          console.info("[master-engine] corrupt ZIP header — using client engine");
          return null;
        }
      }

      const blob = await arrayBufferToValidatedBlob(buffer, mimeForToolExt(ext), format);
      if (!blob) {
        console.info("[master-engine] output failed validation — using client engine");
        return null;
      }

      onProgress?.({ stage: "done", percent: 100 });
      return { blob, ext };
    } finally {
      stopHeartbeat();
      clearTimeout(timer);
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.info(
      "[master-engine] error, using client engine",
      aborted ? "timeout" : err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** @deprecated Use convertViaMasterEngine */
export const convertViaVisionApi = convertViaMasterEngine;

/**
 * Universal conversion: Master Engine (server AI) when eligible → Adobe-style client fallback.
 */
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
