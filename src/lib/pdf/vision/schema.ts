import { z } from "zod";

/** Chart data extracted by the Master Engine. */
export const VisionChartSchema = z.object({
  chartType: z.enum(["bar", "line", "pie", "column"]).optional(),
  title: z.string().optional(),
  categories: z.array(z.string()).optional(),
  series: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.number()),
      }),
    )
    .optional(),
});

/** Normalized bounding box (0–1 fractions of page width/height). */
export const VisionLayoutSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  w: z.number().min(0).max(1).optional(),
  h: z.number().min(0).max(1).optional(),
});

/** Structured block extracted by Vision AI from a single PDF page. */
export const VisionBlockSchema = z.object({
  type: z.enum(["heading", "paragraph", "list", "table", "chart", "shape"]),
  level: z.number().int().min(1).max(6).optional(),
  rtl: z.boolean().optional(),
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  chartType: z.enum(["bar", "line", "pie", "column"]).optional(),
  title: z.string().optional(),
  categories: z.array(z.string()).optional(),
  series: VisionChartSchema.shape.series,
  /** Hex fill for native rectangle shapes (#RRGGBB or RRGGBB). */
  fillColor: z.string().optional(),
  layout: VisionLayoutSchema.optional(),
  fontSize: z.number().min(6).max(96).optional(),
  bold: z.boolean().optional(),
});

export const VisionPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  pageTitle: z.string().optional(),
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
  chart: VisionChartSchema.optional(),
  rtl: z.boolean().optional(),
  notes: z.string().optional(),
});

export const VisionPresentationSchema = z.object({
  slides: z.array(VisionSlideSchema),
  language: z.string().optional(),
});

export type VisionChart = z.infer<typeof VisionChartSchema>;
export type VisionLayout = z.infer<typeof VisionLayoutSchema>;
export type VisionBlock = z.infer<typeof VisionBlockSchema>;
export type VisionPage = z.infer<typeof VisionPageSchema>;
export type VisionDocument = z.infer<typeof VisionDocumentSchema>;
export type VisionSlide = z.infer<typeof VisionSlideSchema>;
export type VisionPresentation = z.infer<typeof VisionPresentationSchema>;

/** All PDF→format tools routed through the Master Engine (server AI path). */
export type MasterConvertTool = "pdf-word" | "pdf-ppt" | "pdf-excel" | "pdf-html";

export const MASTER_PDF_TOOLS = new Set<MasterConvertTool>([
  "pdf-word",
  "pdf-ppt",
  "pdf-excel",
  "pdf-html",
]);

/** @deprecated Use MasterConvertTool */
export type VisionConvertTool = MasterConvertTool;

export const MAX_VISION_PAGES = 15;

/** Must stay within Vercel serverless request body limits (~4.5MB). */
export { VERCEL_SERVERLESS_BODY_LIMIT_BYTES as MAX_VISION_FILE_BYTES } from "@/lib/pdf/vision/upload-limits";
export const VISION_RENDER_SCALE = 2.5;

export function isMasterPdfTool(mode: string): mode is MasterConvertTool {
  return MASTER_PDF_TOOLS.has(mode as MasterConvertTool);
}

export function extForMasterTool(tool: MasterConvertTool): string {
  switch (tool) {
    case "pdf-word":
      return "docx";
    case "pdf-ppt":
      return "pptx";
    case "pdf-excel":
      return "xlsx";
    case "pdf-html":
      return "html";
  }
}
