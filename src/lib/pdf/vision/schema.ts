import { z } from "zod";

/** Structured block extracted by Vision AI from a single PDF page. */
export const VisionBlockSchema = z.object({
  type: z.enum(["heading", "paragraph", "list", "table"]),
  level: z.number().int().min(1).max(6).optional(),
  rtl: z.boolean().optional(),
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
});

export const VisionPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  blocks: z.array(VisionBlockSchema),
});

export const VisionDocumentSchema = z.object({
  pages: z.array(VisionPageSchema),
  language: z.string().optional(),
});

export const VisionSlideSchema = z.object({
  slideNumber: z.number().int().positive(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  paragraphs: z.array(z.string()).optional(),
  table: z
    .object({
      headers: z.array(z.string()).optional(),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
  rtl: z.boolean().optional(),
  notes: z.string().optional(),
});

export const VisionPresentationSchema = z.object({
  slides: z.array(VisionSlideSchema),
  language: z.string().optional(),
});

export type VisionBlock = z.infer<typeof VisionBlockSchema>;
export type VisionPage = z.infer<typeof VisionPageSchema>;
export type VisionDocument = z.infer<typeof VisionDocumentSchema>;
export type VisionSlide = z.infer<typeof VisionSlideSchema>;
export type VisionPresentation = z.infer<typeof VisionPresentationSchema>;

export type VisionConvertTool = "pdf-word" | "pdf-ppt";

export const MAX_VISION_PAGES = 15;
export const MAX_VISION_FILE_BYTES = 25 * 1024 * 1024;
export const VISION_RENDER_SCALE = 2;
