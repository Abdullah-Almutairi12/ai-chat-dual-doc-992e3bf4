/**
 * Browser-only PDF API facade.
 * Import this module dynamically from client components only:
 *   const pdf = await import('@/lib/pdf/client-api');
 */
export { runConversion, saveConversionResult, pdfToDocx, pdfToHtml } from "./convert";
export { mergePdfs, splitEveryPage, deletePages, rotatePages, reorderPages } from "./organize";
export { optimizePdf } from "./optimize";
export { protectPdf, removeProtection } from "./protect";
export { addTextToPdf, redactRegions, applyAnnotations } from "./editor";
export { applySignatures, drawSignatureToBytes, typedSignatureToBytes } from "./sign";
export { addWatermark, removeWatermark } from "./watermark";
export { downloadBlob, sanitizeFileName, validateUpload } from "./security";
export type { UploadKind } from "./security";
