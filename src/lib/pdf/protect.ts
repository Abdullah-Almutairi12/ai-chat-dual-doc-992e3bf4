import { stageProgress, type ProgressFn } from "./progress";
import { requireBrowser } from "./runtime";

export type ProtectionOptions = {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
};

/** Lazy-load @cantoo/pdf-lib — the only pdf-lib fork with real AES-256 encryption support. */
async function loadEncryptionModule() {
  requireBrowser();
  return import("@cantoo/pdf-lib");
}

/** Real AES-256 password protection (plain pdf-lib cannot encrypt — it silently no-ops). */
export async function protectPdf(
  file: File,
  opts: ProtectionOptions,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  onProgress?.(stageProgress("protect", 15));
  const { PDFDocument } = await loadEncryptionModule();
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  onProgress?.(stageProgress("encrypt", 55));
  doc.encrypt({
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword || `${opts.userPassword}_owner`,
    permissions: {
      printing: opts.allowPrinting ? "highResolution" : false,
      copying: opts.allowCopying ?? false,
      modifying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });

  const outBytes = await doc.save();
  onProgress?.(stageProgress("pack", 95));
  return new Blob([outBytes], { type: "application/pdf" });
}

export async function removeProtection(
  file: File,
  password: string,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  onProgress?.(stageProgress("unlock", 20));
  const { PDFDocument } = await loadEncryptionModule();
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { password });
  onProgress?.(stageProgress("pack", 85));
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

/** Fallback when no password is supplied — re-saves the file if it isn't actually encrypted. */
export async function unlockPdfFallback(file: File): Promise<Blob> {
  requireBrowser();
  const { PDFDocument } = await loadEncryptionModule();
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
