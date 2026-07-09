import { supabase } from "@/integrations/supabase/client";

import type { ConvertProgress } from "@/lib/pdf/convert";
import { extForMasterTool, isMasterPdfTool, type MasterConvertTool } from "@/lib/pdf/vision/schema";

export type { MasterConvertTool };
export { isMasterPdfTool };

/** @deprecated Use isMasterPdfTool */
export function isVisionConvertTool(mode: string): mode is MasterConvertTool {
  return isMasterPdfTool(mode);
}

/**
 * Attempt server-side Master Engine conversion.
 * Returns null on ANY failure so the caller can silently fall back to local Tesseract OCR.
 * Never throws for conversion failures — only logs to console.
 */
export async function convertViaMasterEngine(
  file: File,
  tool: MasterConvertTool,
  onProgress?: (p: ConvertProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      console.info("[master-engine] no session — using local OCR fallback");
      return null;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("tool", tool);

    onProgress?.({ stage: "master-upload", percent: 8 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch("/api/pdf/convert-vision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
      });

      // Any non-success → silent local fallback (503 not configured, 500 AI error, 422 invalid output)
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.info("[master-engine] server unavailable, using local OCR fallback", res.status, detail.slice(0, 200));
        return null;
      }

      onProgress?.({ stage: "master-build", percent: 92 });
      const blob = await res.blob();

      if (!blob.size || blob.size < 256) {
        console.info("[master-engine] empty output blob — using local OCR fallback");
        return null;
      }

      onProgress?.({ stage: "done", percent: 100 });
      return { blob, ext: extForMasterTool(tool) };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.info("[master-engine] error, using local OCR fallback", err instanceof Error ? err.message : err);
    return null;
  }
}

/** @deprecated Use convertViaMasterEngine */
export const convertViaVisionApi = convertViaMasterEngine;

/**
 * Universal conversion entry: Master Engine (server AI) → silent Tesseract/client fallback.
 * Applies to all PDF→format tools; other modes go straight to client engine.
 */
export async function runMasterConversion(
  mode: string,
  file: File,
  extra?: { imageFiles?: File[]; imageFormat?: "jpeg" | "png" },
  onProgress?: (p: ConvertProgress) => void,
): Promise<{ blob?: Blob; blobs?: { name: string; blob: Blob }[]; ext: string }> {
  if (isMasterPdfTool(mode)) {
    const master = await convertViaMasterEngine(file, mode, onProgress);
    if (master) {
      return { blob: master.blob, ext: master.ext };
    }
  }

  const { runConversion } = await import("@/lib/pdf/convert");
  return runConversion(mode, file, extra, onProgress);
}
