import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import {
  PORTRAIT_CONTENT_W,
  PORTRAIT_HEIGHT_IN,
  PORTRAIT_MARGIN_X,
} from "@/lib/pdf/vision/layout-constants";
import type { VisionBlock, VisionLayout } from "@/lib/pdf/vision/schema";

/** Latin body font for Office exports. */
export const LATIN_FONT = "Calibri";
/** Arabic text — Arial has reliable RTL shaping in Word/PowerPoint. */
export const ARABIC_FONT = "Arial";

export function rtlFor(text: string, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return isRtlDominant(text);
}

export function fontFor(rtl: boolean): string {
  return rtl ? ARABIC_FONT : LATIN_FONT;
}

/** Normalize #RRGGBB or RRGGBB to uppercase hex without hash (Office fill). */
export function stripHexColor(color?: string): string | undefined {
  if (!color) return undefined;
  const c = color.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
  return undefined;
}

export type InchesBox = { x: number; y: number; w: number; h: number; usedFlowY: boolean };

/** Map normalized 0–1 layout fractions to portrait slide/page inches. */
export function layoutToInches(layout: VisionLayout | undefined, flowY: number): InchesBox {
  const usedFlowY = layout?.y == null;
  const x = layout?.x != null ? PORTRAIT_MARGIN_X + layout.x * PORTRAIT_CONTENT_W : PORTRAIT_MARGIN_X;
  const y = layout?.y != null ? layout.y * PORTRAIT_HEIGHT_IN : flowY;
  const w = layout?.w != null ? Math.max(0.15, layout.w * PORTRAIT_CONTENT_W) : PORTRAIT_CONTENT_W;
  const h = layout?.h != null ? Math.max(0.12, layout.h * PORTRAIT_HEIGHT_IN) : 0.5;
  return { x, y, w, h, usedFlowY };
}

export function primaryText(block: VisionBlock): string {
  if (block.text?.trim()) return normalizeArabicText(block.text);
  const firstItem = block.items?.find((i) => i.trim());
  return firstItem ? normalizeArabicText(firstItem) : "";
}

export function blockRtl(block: VisionBlock): boolean {
  return rtlFor(primaryText(block), block.rtl);
}

/** Master Engine must never produce raster page dumps — strip if present. */
export function stripForbiddenImageBlocks(blocks: VisionBlock[]): VisionBlock[] {
  return blocks.filter((b) => {
    const t = b.type as string;
    return t !== "image" && t !== "page_image" && t !== "background";
  });
}
