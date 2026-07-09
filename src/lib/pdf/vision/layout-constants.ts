/** Shared portrait layout for Word/PPT exports (US Letter, vertical). */
export const PORTRAIT_LAYOUT_NAME = "PDFQUANTA_PORTRAIT";
export const PORTRAIT_WIDTH_IN = 8.5;
export const PORTRAIT_HEIGHT_IN = 11;
/** Usable content width inside portrait slides (inches). */
export const PORTRAIT_CONTENT_W = 7.5;
export const PORTRAIT_MARGIN_X = 0.5;

export const OFFICE_MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  html: "text/html;charset=utf-8",
} as const;

export const OFFICE_EXT: Record<string, string> = {
  "pdf-word": "docx",
  "pdf-ppt": "pptx",
  "pdf-excel": "xlsx",
  "pdf-html": "html",
};
