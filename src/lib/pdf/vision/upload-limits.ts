/** Limits for server-side Master Engine uploads on Vercel serverless. */
export const VERCEL_SERVERLESS_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

/** Stay under Nitro/Vercel route maxDuration (60s). */
export const MASTER_FETCH_TIMEOUT_MS = 50_000;

/** Client-side max for tools that POST the PDF body to /api/pdf/convert-vision. */
export const MASTER_CLIENT_UPLOAD_LIMIT_BYTES = VERCEL_SERVERLESS_BODY_LIMIT_BYTES;

/** Max PDF size the server will process when fetched from Supabase storage. */
export const MASTER_SERVER_PROCESS_LIMIT_BYTES = 20 * 1024 * 1024;

export function canUploadToMasterEngine(file: File): boolean {
  return file.size > 0 && file.size <= MASTER_CLIENT_UPLOAD_LIMIT_BYTES;
}

export function masterSkipReason(file: File): string | null {
  if (file.size <= 0) return "empty_file";
  if (file.size > MASTER_CLIENT_UPLOAD_LIMIT_BYTES) {
    return `file_too_large_for_server_${Math.ceil(file.size / (1024 * 1024))}mb`;
  }
  return null;
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}
