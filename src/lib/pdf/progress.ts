/** Unified progress shape for every PDF Quanta tool. */
export type PdfProgress = {
  stage: string;
  percent: number;
  page?: number;
  pageCount?: number;
  fileIndex?: number;
  fileCount?: number;
};

export type ProgressFn = (p: PdfProgress) => void;

/** @deprecated Use PdfProgress */
export type ConvertProgress = PdfProgress;

export function clampPercent(n: number): number {
  return Math.max(4, Math.min(100, Math.round(n)));
}

/** Map inner file progress into a multi-file batch (0–100 overall). */
export function batchFilePercent(fileIndex: number, fileCount: number, innerPercent: number): number {
  if (fileCount <= 0) return clampPercent(innerPercent);
  const slice = 100 / fileCount;
  return clampPercent(fileIndex * slice + (innerPercent / 100) * slice);
}

/** Map page progress within a single file (optionally nested in a batch). */
export function pagePercent(
  page: number,
  pageCount: number,
  opts?: { fileIndex?: number; fileCount?: number; stage?: string },
): PdfProgress {
  const inner = pageCount > 0 ? (page / pageCount) * 100 : 0;
  const percent =
    opts?.fileCount && opts.fileIndex !== undefined
      ? batchFilePercent(opts.fileIndex, opts.fileCount, inner)
      : clampPercent(inner);
  return {
    stage: opts?.stage ?? "process",
    percent,
    page,
    pageCount,
    fileIndex: opts?.fileIndex,
    fileCount: opts?.fileCount,
  };
}

export function stageProgress(stage: string, percent: number, extra?: Partial<PdfProgress>): PdfProgress {
  return { stage, percent: clampPercent(percent), ...extra };
}
