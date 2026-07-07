import { supabase } from "@/integrations/supabase/client";
import {
  buildStorageObjectPath,
  bucketForPdfTool,
  STORAGE_BUCKETS,
  type StorageBucketId,
} from "@/integrations/supabase/storage-buckets";

/** Upload a file via authenticated API route (works on Vercel + Supabase RLS). */
export async function uploadFileViaApi(
  file: File | Blob,
  opts: { bucket?: StorageBucketId; toolId?: string; fileName?: string },
): Promise<{ bucket: string; path: string } | null> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return null;

  const form = new FormData();
  const name = opts.fileName ?? (file instanceof File ? file.name : "output.bin");
  form.append("file", file instanceof File ? file : new File([file], name));
  if (opts.bucket) form.append("bucket", opts.bucket);
  if (opts.toolId) form.append("toolId", opts.toolId);

  const res = await fetch("/api/pdf/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    bucket?: string;
    path?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.path) {
    console.warn("[storage] upload failed", body.error ?? res.status);
    return null;
  }
  return { bucket: body.bucket ?? opts.bucket ?? STORAGE_BUCKETS.files, path: body.path };
}

/** Direct client upload (when storage RLS policies are applied). */
export async function uploadFileDirect(
  userId: string,
  file: File | Blob,
  opts: { bucket?: StorageBucketId; toolId?: string; fileName?: string },
): Promise<{ bucket: string; path: string } | null> {
  const bucket = opts.bucket ?? (opts.toolId ? bucketForPdfTool(opts.toolId) : STORAGE_BUCKETS.files);
  const fileName = opts.fileName ?? (file instanceof File ? file.name : "output.bin");
  const path = buildStorageObjectPath(userId, fileName);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file instanceof File ? file.type || undefined : undefined,
  });
  if (error) {
    console.warn("[storage] direct upload failed", error.message);
    return null;
  }
  return { bucket, path };
}

/** Best-effort upload — tries API route first, then direct storage. */
export async function persistProcessedFile(
  userId: string,
  file: File | Blob,
  opts: { bucket?: StorageBucketId; toolId?: string; fileName?: string },
): Promise<void> {
  const viaApi = await uploadFileViaApi(file, opts);
  if (viaApi) return;
  await uploadFileDirect(userId, file, opts);
}

/** Reserve processing slot via API (used by PDF tools workspace). */
export async function consumeProcessingSlot(meta: {
  fileName?: string;
  fileSize?: number;
  tool?: string;
}): Promise<{ allowed: boolean; remaining: number | null; subscribed: boolean } | null> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return null;

  const res = await fetch("/api/pdf/consume", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(meta),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    allowed?: boolean;
    remaining?: number | null;
    subscribed?: boolean;
    error?: string;
  };
  if (!res.ok || !body.ok) {
    console.warn("[storage] consume failed", body.error ?? res.status);
    return null;
  }
  return {
    allowed: body.allowed === true,
    remaining: body.remaining ?? null,
    subscribed: body.subscribed === true,
  };
}
