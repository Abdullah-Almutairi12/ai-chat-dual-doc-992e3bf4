import { loadPdfLib, pdfLibToBlob } from "./loader";
import { stageProgress, type ProgressFn } from "./progress";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export type ProtectionOptions = {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
};

export async function protectPdf(
  file: File,
  opts: ProtectionOptions,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  onProgress?.(stageProgress("protect", 20));
  const doc = await loadPdfLib(file);
  onProgress?.(stageProgress("encrypt", 60));
  const bytes = await doc.save({
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword ?? opts.userPassword + "_owner",
    permissions: {
      printing: opts.allowPrinting ? ("highResolution" as const) : ("lowResolution" as const),
      copying: opts.allowCopying ?? false,
      modifying: false,
    },
  });
  onProgress?.(stageProgress("pack", 95));
  return new Blob([bytes], { type: "application/pdf" });
}

export async function removeProtection(
  file: File,
  password: string,
  onProgress?: ProgressFn,
): Promise<Blob> {
  requireBrowser();
  onProgress?.(stageProgress("unlock", 25));
  const buf = await file.arrayBuffer();
  const { PDFDocument } = await loadPdfLibModule();
  const doc = await PDFDocument.load(buf, { password });
  onProgress?.(stageProgress("pack", 85));
  return pdfLibToBlob(doc);
}

/** Silent fallback when password unlock fails — re-save if PDF is not encrypted. */
export async function unlockPdfFallback(file: File): Promise<Blob> {
  requireBrowser();
  const doc = await loadPdfLib(file);
  return pdfLibToBlob(doc);
}
