/** Yield to the browser event loop between heavy operations (prevents UI freeze / OOM spikes). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export const MAX_MERGE_FILES = 50;
export const MAX_TOTAL_BATCH_BYTES = 80 * 1024 * 1024;

/** Validate batch totals before merge / multi-file ops. */
export function validateBatchSize(files: File[]): { ok: true } | { ok: false; reason: "count" | "size" } {
  if (files.length > MAX_MERGE_FILES) return { ok: false, reason: "count" };
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BATCH_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}
