import { stripForbiddenImageBlocks, stripHexColor } from "@/lib/pdf/vision/block-layout.server";
import {
  VisionBlockSchema,
  VisionPageSchema,
  type VisionBlock,
  type VisionPage,
} from "@/lib/pdf/vision/schema";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const MIN_OFFICE_BYTES = 512;

export function logMaster(stage: string, meta: Record<string, unknown> = {}): void {
  console.info(`[master-engine] ${stage}`, JSON.stringify({ ts: new Date().toISOString(), ...meta }));
}

/** Sanitize a single text field for OOXML-safe content. */
export function sanitizeText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7F-\x9F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
}

function clampLayout(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function normalizeBlockType(raw: unknown): VisionBlock["type"] | null {
  if (typeof raw !== "string") return null;
  const t = raw.toLowerCase().trim();
  const allowed: VisionBlock["type"][] = ["heading", "paragraph", "list", "table", "chart", "shape"];
  return (allowed as string[]).includes(t) ? (t as VisionBlock["type"]) : null;
}

/** Coerce loosely-typed AI block into schema-safe shape before zod parse. */
function coerceBlock(raw: unknown): VisionBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const type = normalizeBlockType(obj.type);
  if (!type) return null;

  const block: Record<string, unknown> = { type };

  if (typeof obj.rtl === "boolean") block.rtl = obj.rtl;
  if (typeof obj.text === "string") block.text = sanitizeText(obj.text);
  if (typeof obj.title === "string") block.title = sanitizeText(obj.title);
  if (typeof obj.bold === "boolean") block.bold = obj.bold;

  if (typeof obj.level === "number" && Number.isFinite(obj.level)) {
    block.level = Math.min(6, Math.max(1, Math.round(obj.level)));
  }
  if (typeof obj.fontSize === "number" && Number.isFinite(obj.fontSize)) {
    block.fontSize = Math.min(96, Math.max(6, Math.round(obj.fontSize)));
  }
  if (typeof obj.fillColor === "string") {
    block.fillColor = stripHexColor(sanitizeText(obj.fillColor)) ?? undefined;
  }

  if (Array.isArray(obj.items)) {
    block.items = obj.items
      .filter((i): i is string => typeof i === "string")
      .map(sanitizeText)
      .filter(Boolean);
  }

  if (Array.isArray(obj.rows)) {
    block.rows = obj.rows
      .filter(Array.isArray)
      .map((row) =>
        (row as unknown[])
          .filter((c): c is string => typeof c === "string")
          .map(sanitizeText),
      )
      .filter((row) => row.some((c) => c.length > 0));
  }

  if (Array.isArray(obj.categories)) {
    block.categories = obj.categories
      .filter((c): c is string => typeof c === "string")
      .map(sanitizeText)
      .filter(Boolean);
  }

  if (Array.isArray(obj.series)) {
    block.series = obj.series
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
      .map((s) => ({
        name: sanitizeText(String(s.name ?? "")),
        values: Array.isArray(s.values)
          ? s.values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0))
          : [],
      }))
      .filter((s) => s.name.length > 0);
  }

  if (typeof obj.chartType === "string") {
    const ct = obj.chartType.toLowerCase();
    if (ct === "bar" || ct === "line" || ct === "pie" || ct === "column") {
      block.chartType = ct;
    }
  }

  if (obj.layout && typeof obj.layout === "object") {
    const l = obj.layout as Record<string, unknown>;
    block.layout = {
      x: clampLayout(l.x as number | undefined, 0),
      y: clampLayout(l.y as number | undefined, 0),
      w: clampLayout(l.w as number | undefined, 1),
      h: clampLayout(l.h as number | undefined, 0.1),
    };
  }

  const parsed = VisionBlockSchema.safeParse(block);
  return parsed.success ? parsed.data : null;
}

/** Coerce AI page payload to typed VisionPage with full string sanitization. */
export function coerceVisionPage(raw: unknown, pageNumber: number): VisionPage {
  if (!raw || typeof raw !== "object") {
    return { pageNumber, blocks: [] };
  }

  const obj = raw as Record<string, unknown>;
  const blocksRaw = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks = blocksRaw.map(coerceBlock).filter((b): b is VisionBlock => Boolean(b));

  const pageTitle =
    typeof obj.pageTitle === "string"
      ? sanitizeText(obj.pageTitle)
      : typeof obj.title === "string"
        ? sanitizeText(obj.title)
        : undefined;

  const candidate = {
    pageNumber,
    pageTitle: pageTitle || undefined,
    blocks,
  };

  const parsed = VisionPageSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  return { pageNumber, blocks };
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
  if (base.fillColor) {
    base.fillColor = stripHexColor(base.fillColor) ?? undefined;
  }
  return base;
}

function blockHasContent(block: VisionBlock): boolean {
  if (block.type === "shape") {
    return Boolean(stripHexColor(block.fillColor) || block.text?.trim());
  }
  if (block.text?.trim()) return true;
  if (block.items?.length) return true;
  if (block.rows?.length) return true;
  if (block.series?.length) return true;
  return false;
}

export function sanitizePages(pages: VisionPage[]): VisionPage[] {
  return pages.map((p) => ({
    pageNumber: p.pageNumber,
    pageTitle: p.pageTitle ? sanitizeText(p.pageTitle) : undefined,
    blocks: stripForbiddenImageBlocks(p.blocks.map(sanitizeBlock)).filter((b) => blockHasContent(b)),
  }));
}

export function countPageContent(pages: VisionPage[]): number {
  return pages.reduce((sum, p) => sum + p.blocks.length, 0);
}

function isZipBuffer(buf: Buffer | Uint8Array): boolean {
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
    logMaster("validation_failed", { tool, bytes: buffer.length, head: buffer.subarray(0, 4).toString("hex") });
    throw new MasterBuildValidationError(`Invalid ${tool} output (${buffer.length} bytes)`);
  }
  logMaster("validation_passed", { tool, bytes: buffer.length });
}
