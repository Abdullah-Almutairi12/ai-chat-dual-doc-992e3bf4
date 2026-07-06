import {
  ArrowLeftRight,
  Combine,
  Droplets,
  Eraser,
  FileImage,
  FileLock,
  FileOutput,
  FilePen,
  FileSpreadsheet,
  FileType2,
  Highlighter,
  Layers,
  Minimize2,
  PenLine,
  Presentation,
  RotateCw,
  Scissors,
  ShieldCheck,
  Split,
  Stamp,
  type LucideIcon,
} from "lucide-react";

import type { TranslationKey } from "./translations";

export type PdfToolCategory = "convert" | "organize" | "watermark" | "optimize" | "edit" | "sign" | "protect";

export type PdfTool = {
  id: string;
  category: PdfToolCategory;
  icon: LucideIcon;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  /** Conversion mode passed to runConversion when applicable */
  convertMode?: string;
  accept?: string;
  multiFile?: boolean;
};

export const PDF_TOOL_CATEGORIES: { id: PdfToolCategory; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: "convert", titleKey: "pdf_cat_convert", descKey: "pdf_cat_convert_desc" },
  { id: "organize", titleKey: "pdf_cat_organize", descKey: "pdf_cat_organize_desc" },
  { id: "watermark", titleKey: "pdf_cat_watermark", descKey: "pdf_cat_watermark_desc" },
  { id: "optimize", titleKey: "pdf_cat_optimize", descKey: "pdf_cat_optimize_desc" },
  { id: "edit", titleKey: "pdf_cat_edit", descKey: "pdf_cat_edit_desc" },
  { id: "sign", titleKey: "pdf_cat_sign", descKey: "pdf_cat_sign_desc" },
  { id: "protect", titleKey: "pdf_cat_protect", descKey: "pdf_cat_protect_desc" },
];

export const pdfTools: PdfTool[] = [
  // Convert
  { id: "pdf-word", category: "convert", icon: FileType2, titleKey: "pdf_tool_word", descKey: "pdf_tool_word_desc", convertMode: "pdf-word" },
  { id: "pdf-excel", category: "convert", icon: FileSpreadsheet, titleKey: "pdf_tool_excel", descKey: "pdf_tool_excel_desc", convertMode: "pdf-excel" },
  { id: "pdf-ppt", category: "convert", icon: Presentation, titleKey: "pdf_tool_ppt", descKey: "pdf_tool_ppt_desc", convertMode: "pdf-ppt" },
  { id: "pdf-jpg", category: "convert", icon: FileImage, titleKey: "pdf_tool_jpg", descKey: "pdf_tool_jpg_desc", convertMode: "pdf-jpg" },
  { id: "pdf-png", category: "convert", icon: FileImage, titleKey: "pdf_tool_png", descKey: "pdf_tool_png_desc", convertMode: "pdf-png" },
  { id: "pdf-html", category: "convert", icon: FileOutput, titleKey: "pdf_tool_html", descKey: "pdf_tool_html_desc", convertMode: "pdf-html" },
  { id: "images-pdf", category: "convert", icon: Layers, titleKey: "pdf_tool_images_pdf", descKey: "pdf_tool_images_pdf_desc", convertMode: "images-pdf", accept: "image/*", multiFile: true },
  { id: "office-pdf", category: "convert", icon: ArrowLeftRight, titleKey: "pdf_tool_office_pdf", descKey: "pdf_tool_office_pdf_desc", convertMode: "office-pdf", accept: ".docx,.xlsx,.pptx,.doc,.xls,.ppt" },
  // Organize
  { id: "merge", category: "organize", icon: Combine, titleKey: "pdf_tool_merge", descKey: "pdf_tool_merge_desc", multiFile: true },
  { id: "split", category: "organize", icon: Split, titleKey: "pdf_tool_split", descKey: "pdf_tool_split_desc" },
  { id: "rotate", category: "organize", icon: RotateCw, titleKey: "pdf_tool_rotate", descKey: "pdf_tool_rotate_desc" },
  { id: "delete-pages", category: "organize", icon: Scissors, titleKey: "pdf_tool_delete", descKey: "pdf_tool_delete_desc" },
  { id: "reorder", category: "organize", icon: Layers, titleKey: "pdf_tool_reorder", descKey: "pdf_tool_reorder_desc" },
  // Watermark
  { id: "watermark-add", category: "watermark", icon: Droplets, titleKey: "pdf_tool_wm_add", descKey: "pdf_tool_wm_add_desc" },
  { id: "watermark-remove", category: "watermark", icon: Eraser, titleKey: "pdf_tool_wm_remove", descKey: "pdf_tool_wm_remove_desc" },
  // Optimize
  { id: "compress", category: "optimize", icon: Minimize2, titleKey: "pdf_tool_compress", descKey: "pdf_tool_compress_desc" },
  // Edit
  { id: "annotate", category: "edit", icon: Highlighter, titleKey: "pdf_tool_annotate", descKey: "pdf_tool_annotate_desc" },
  { id: "add-text", category: "edit", icon: FilePen, titleKey: "pdf_tool_add_text", descKey: "pdf_tool_add_text_desc" },
  { id: "redact", category: "edit", icon: Eraser, titleKey: "pdf_tool_redact", descKey: "pdf_tool_redact_desc" },
  // Sign
  { id: "sign", category: "sign", icon: PenLine, titleKey: "pdf_tool_sign", descKey: "pdf_tool_sign_desc" },
  { id: "stamp", category: "sign", icon: Stamp, titleKey: "pdf_tool_stamp", descKey: "pdf_tool_stamp_desc" },
  // Protect
  { id: "protect", category: "protect", icon: FileLock, titleKey: "pdf_tool_protect", descKey: "pdf_tool_protect_desc" },
  { id: "unlock", category: "protect", icon: ShieldCheck, titleKey: "pdf_tool_unlock", descKey: "pdf_tool_unlock_desc" },
];

export function getPdfTool(id: string): PdfTool | undefined {
  return pdfTools.find((t) => t.id === id);
}

export function toolsByCategory(category: PdfToolCategory): PdfTool[] {
  return pdfTools.filter((t) => t.category === category);
}

export const aiTools = [
  "chat",
  "tables",
  "proofreader",
  "quiz",
  "analyzer",
] as const;
