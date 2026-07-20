import type { LayoutBox } from "@/lib/pdf-layout";

export function safeLayoutText(raw: string): string {
  return raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}

/** Designed PDFs expose one glyph per box — unusable for Office export. */
export function isBrokenTextLayout(boxes: LayoutBox[], pageW: number): boolean {
  if (boxes.length === 0) return false;
  if (boxes.length > 100) return true;

  const nonSpace = boxes.filter((b) => safeLayoutText(b.text).length > 0);
  if (!nonSpace.length) return true;

  const tiny = nonSpace.filter((b) => b.text.replace(/\s/g, "").length <= 1).length;
  if (tiny / nonSpace.length > 0.45) return true;

  const avgW = nonSpace.reduce((s, b) => s + b.width, 0) / nonSpace.length;
  if (avgW < pageW * 0.018) return true;

  return false;
}

export function countUsableTextBoxes(boxes: LayoutBox[]): number {
  return boxes.filter((b) => safeLayoutText(b.text).length > 1).length;
}
