import { loadPdfLib, pdfLibToBlob } from "./loader";
import { loadPdfLibModule, requireBrowser } from "./runtime";

export type ProtectionOptions = {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
};

export async function protectPdf(file: File, opts: ProtectionOptions): Promise<Blob> {
  requireBrowser();
  const doc = await loadPdfLib(file);
  const bytes = await doc.save({
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword ?? opts.userPassword + "_owner",
    permissions: {
      printing: opts.allowPrinting ? ("highResolution" as const) : ("lowResolution" as const),
      copying: opts.allowCopying ?? false,
      modifying: false,
    },
  });
  return new Blob([bytes], { type: "application/pdf" });
}

export async function removeProtection(file: File, password: string): Promise<Blob> {
  requireBrowser();
  const buf = await file.arrayBuffer();
  const { PDFDocument } = await loadPdfLibModule();
  const doc = await PDFDocument.load(buf, { password });
  return pdfLibToBlob(doc);
}
