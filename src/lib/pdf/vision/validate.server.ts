import type { VisionBlock, VisionPage, VisionSlide } from "@/lib/pdf/vision/schema";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const MIN_OFFICE_BYTES = 512;

export function logMaster(stage: string, meta: Record<string, unknown> = {}): void {
  console.info(`[master-engine] ${stage}`, JSON.stringify({ ts: new Date().toISOString(), ...meta }));
}

export function sanitizeText(value: string): string {
  return value
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim();
}

export function sanitizeBlock(block: VisionBlock): VisionBlock {
  const base = { ...block };
  if (base.text) base.text = sanitizeText(base.text);
  if (base.title) base.title = sanitizeText(base.title);
  if (base.items) base.items = base.items.map(sanitizeText).filter(Boolean);
  if (base.rows) {
    base.rows = base.rows
      .map((row) => row.map(sanitizeText))
      .filter((row) => row.some((c) => c.length > 0));
  }
  if (base.categories) base.categories = base.categories.map(sanitizeText).filter(Boolean);
  if (base.series) {
    base.series = base.series
      .map((s) => ({
        name: sanitizeText(s.name),
        values: s.values.map((v) => (Number.isFinite(v) ? v : 0)),
      }))
      .filter((s) => s.name.length > 0);
  }
  return base;
}

export function sanitizePages(pages: VisionPage[]): VisionPage[] {
  return pages.map((p) => ({
    ...p,
    blocks: p.blocks.map(sanitizeBlock).filter((b) => blockHasContent(b)),
  }));
}

export function sanitizeSlides(slides: VisionSlide[]): VisionSlide[] {
  return slides.map((s) => ({
    ...s,
    title: s.title ? sanitizeText(s.title) : undefined,
    subtitle: s.subtitle ? sanitizeText(s.subtitle) : undefined,
    bullets: s.bullets?.map(sanitizeText).filter(Boolean),
    paragraphs: s.paragraphs?.map(sanitizeText).filter(Boolean),
    notes: s.notes ? sanitizeText(s.notes) : undefined,
    table: s.table
      ? {
          headers: s.table.headers?.map(sanitizeText),
          rows: s.table.rows.map((row) => row.map(sanitizeText)),
        }
      : undefined,
    chart: s.chart
      ? {
          ...s.chart,
          title: s.chart.title ? sanitizeText(s.chart.title) : undefined,
          categories: s.chart.categories?.map(sanitizeText),
          series: s.chart.series?.map((ser) => ({
            name: sanitizeText(ser.name),
            values: ser.values.map((v) => (Number.isFinite(v) ? v : 0)),
          })),
        }
      : undefined,
  }));
}

function blockHasContent(block: VisionBlock): boolean {
  if (block.text?.trim()) return true;
  if (block.items?.length) return true;
  if (block.rows?.length) return true;
  if (block.series?.length) return true;
  return false;
}

export function countPageContent(pages: VisionPage[]): number {
  return pages.reduce((sum, p) => sum + p.blocks.length, 0);
}

export function countSlideContent(slides: VisionSlide[]): number {
  return slides.reduce((sum, s) => {
    let n = 0;
    if (s.title) n++;
    if (s.subtitle) n++;
    n += s.bullets?.length ?? 0;
    n += s.paragraphs?.length ?? 0;
    if (s.table?.rows?.length) n++;
    if (s.chart?.series?.length) n++;
    return sum + n;
  }, 0);
}

function isZipBuffer(buf: Buffer): boolean {
  if (buf.length < MIN_OFFICE_BYTES) return false;
  return ZIP_MAGIC.every((byte, i) => buf[i] === byte);
}

export function validateDocxBuffer(buf: Buffer): boolean {
  return isZipBuffer(buf) && buf.length >= MIN_OFFICE_BYTES;
}

export function validatePptxBuffer(buf: Buffer): boolean {
  return isZipBuffer(buf) && buf.length >= MIN_OFFICE_BYTES;
}

export function validateXlsxBuffer(buf: Buffer): boolean {
  return isZipBuffer(buf) && buf.length >= MIN_OFFICE_BYTES;
}

export function validateHtmlBuffer(buf: Buffer): boolean {
  const text = buf.toString("utf-8");
  return text.length >= 32 && (text.includes("<html") || text.includes("<!DOCTYPE"));
}

export class MasterBuildValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterBuildValidationError";
  }
}

export function assertValidOutput(tool: string, buffer: Buffer): void {
  const ok =
    tool === "pdf-word"
      ? validateDocxBuffer(buffer)
      : tool === "pdf-ppt"
        ? validatePptxBuffer(buffer)
        : tool === "pdf-excel"
          ? validateXlsxBuffer(buffer)
          : tool === "pdf-html"
            ? validateHtmlBuffer(buffer)
            : buffer.length > 0;

  if (!ok) {
    logMaster("validation_failed", { tool, bytes: buffer.length });
    throw new MasterBuildValidationError(`Invalid ${tool} output (${buffer.length} bytes)`);
  }
  logMaster("validation_passed", { tool, bytes: buffer.length });
}
