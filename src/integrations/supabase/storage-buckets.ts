/** Supabase Storage bucket IDs used across PDF Quanta. */
export const STORAGE_BUCKETS = {
  /** Raw user uploads (chat, dropzone, general files). */
  files: "files",
  /** Processed outputs and document library artifacts. */
  documents: "documents",
  /** Integrated PDF tools workspace (/tools/*). */
  pdfTools: "pdf-tools",
} as const;

export type StorageBucketId = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Resolve bucket for a PDF integrated tool job. */
export function bucketForPdfTool(_toolId: string): StorageBucketId {
  return STORAGE_BUCKETS.pdfTools;
}

/** Object path: `{userId}/{timestamp}-{safeFileName}` */
export function buildStorageObjectPath(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);
  return `${userId}/${Date.now()}-${safe || "file"}`;
}
