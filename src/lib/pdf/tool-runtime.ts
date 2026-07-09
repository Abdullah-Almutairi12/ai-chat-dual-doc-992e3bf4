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
