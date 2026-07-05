import { loadPdfLib, pdfLibToBlob } from "./loader";

export type ProtectionOptions = {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
};

/**
 * Set document passwords and permissions.
 * pdf-lib supports encryption with user/owner passwords.
 */
export async function protectPdf(file: File, opts: ProtectionOptions): Promise<Blob> {
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

/** Remove password protection by re-saving an unlocked copy (requires correct password at load time). */
export async function removeProtection(file: File, password: string): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(buf, { password });
  return pdfLibToBlob(doc);
}
