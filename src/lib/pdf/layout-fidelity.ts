/** Shared layout → Office inch conversion (Adobe-style positioned export). */

import {
  PORTRAIT_CONTENT_W,
  PORTRAIT_HEIGHT_IN,
  PORTRAIT_MARGIN_X,
  PORTRAIT_WIDTH_IN,
} from "@/lib/pdf/vision/layout-constants";
import type { VisionLayout } from "@/lib/pdf/vision/schema";

export type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  text: string;
  rtl: boolean;
};

/** US Letter page size in twips (1/20 pt). */
export const DOCX_PAGE_W_TWIPS = 12240;
export const DOCX_PAGE_H_TWIPS = 15840;

export function layoutToDocxTwips(layout: { x?: number; y?: number; w?: number; h?: number }) {
  return {
    before: Math.round((layout.y ?? 0) * DOCX_PAGE_H_TWIPS),
    left: Math.round((layout.x ?? 0) * DOCX_PAGE_W_TWIPS),
    width: Math.round((layout.w ?? 1) * DOCX_PAGE_W_TWIPS),
    height: Math.max(200, Math.round((layout.h ?? 0.05) * DOCX_PAGE_H_TWIPS)),
  };
}

export function normLayoutToInches(layout: VisionLayout): { x: number; y: number; w: number; h: number } {
  const x = layout.x != null ? PORTRAIT_MARGIN_X + layout.x * PORTRAIT_CONTENT_W : PORTRAIT_MARGIN_X;
  const y = layout.y != null ? layout.y * PORTRAIT_HEIGHT_IN : 0.5;
  const w = layout.w != null ? Math.max(0.2, layout.w * PORTRAIT_CONTENT_W) : PORTRAIT_CONTENT_W;
  const h = layout.h != null ? Math.max(0.12, layout.h * PORTRAIT_HEIGHT_IN) : 0.45;
  return { x, y, w, h };
}

export function pixelBoxToInches(
  box: PixelBox,
  pageW: number,
  pageH: number,
  slideW = PORTRAIT_WIDTH_IN,
  slideH = PORTRAIT_HEIGHT_IN,
): { x: number; y: number; w: number; h: number; fontSize: number } {
  return {
    x: (box.left / pageW) * slideW,
    y: (box.top / pageH) * slideH,
    w: Math.max((box.width / pageW) * slideW, 0.25),
    h: Math.max((box.height / pageH) * slideH, 0.12),
    fontSize: Math.min(36, Math.max(8, (box.fontSize / pageH) * slideH * 72)),
  };
}
