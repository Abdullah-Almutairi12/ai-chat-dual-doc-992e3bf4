import { ensureValidOutput, formatFromFileName, type OutputFormat } from "@/lib/pdf/validate-output";

/** Log tool errors server-side / console only — never expose raw messages to users. */
export function logToolError(toolId: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[pdf-tool:${toolId}]`, message, context ?? "");
}

/**
 * Run a tool operation; on failure log silently and return null
 * so the caller can attempt an alternative strategy.
 */
export async function tryToolOperation<T>(
  toolId: string,
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logToolError(toolId, err, { phase: label });
    return null;
  }
}

/** Validate then return blob, or null if corrupt. */
export async function finalizeOutput(
  blob: Blob | null | undefined,
  fileName: string,
  explicitFormat?: OutputFormat,
): Promise<Blob | null> {
  if (!blob?.size) return null;
  const format = explicitFormat ?? formatFromFileName(fileName);
  return ensureValidOutput(blob, format);
}

export type ConversionRunResult = {
  blob?: Blob;
  blobs?: { name: string; blob: Blob }[];
  ext: string;
};

export type AppliedConversion =
  | { kind: "single"; blob: Blob; fileName: string }
  | { kind: "multi"; downloaded: number; total: number };

/**
 * Validate a conversion result and normalize into a single downloadable file
 * or a count of multi-file downloads.
 */
export async function applyConversionResult(
  result: ConversionRunResult,
  baseName: string,
): Promise<AppliedConversion | null> {
  if (result.blob) {
    const fileName = `${baseName}.${result.ext}`;
    const valid = await finalizeOutput(result.blob, fileName);
    if (!valid) return null;
    return { kind: "single", blob: valid, fileName };
  }

  if (result.blobs?.length) {
    const { validatedDownloadBlob } = await import("@/lib/pdf/security");
    let downloaded = 0;
    for (const item of result.blobs) {
      if (await validatedDownloadBlob(item.blob, item.name)) downloaded++;
    }
    return { kind: "multi", downloaded, total: result.blobs.length };
  }

  return null;
}
