import { supabase } from "@/integrations/supabase/client";

import type { ConvertProgress } from "@/lib/pdf/convert";

export type VisionConvertTool = "pdf-word" | "pdf-ppt";

const VISION_TOOLS = new Set<VisionConvertTool>(["pdf-word", "pdf-ppt"]);

export function isVisionConvertTool(mode: string): mode is VisionConvertTool {
  return VISION_TOOLS.has(mode as VisionConvertTool);
}

/**
 * Server-side Vision AI conversion (PDF → editable DOCX/PPTX).
 * Returns null when Vision is not configured (503) so caller can fall back to client conversion.
 */
export async function convertViaVisionApi(
  file: File,
  tool: VisionConvertTool,
  onProgress?: (p: ConvertProgress) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const form = new FormData();
  form.append("file", file);
  form.append("tool", tool);

  onProgress?.({ stage: "vision-upload", percent: 8 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch("/api/pdf/convert-vision", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });

    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      if (body.code === "VISION_NOT_CONFIGURED") return null;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Vision conversion failed (${res.status})`);
    }

    onProgress?.({ stage: "vision-build", percent: 92 });
    const blob = await res.blob();
    const ext = tool === "pdf-word" ? "docx" : "pptx";
    onProgress?.({ stage: "done", percent: 100 });
    return { blob, ext };
  } finally {
    clearTimeout(timer);
  }
}
