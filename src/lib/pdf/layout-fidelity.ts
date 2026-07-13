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
