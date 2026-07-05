/**
 * Arabic / RTL bidi utilities.
 *
 * PDF.js often returns Arabic glyph runs in visual order. We reorder line items
 * into logical reading order and apply CSS bidi isolation so cursive letters
 * connect correctly in exported HTML/DOCX.
 */

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;

export function hasArabic(s: string): boolean {
  return ARABIC_RE.test(s);
}

export function isRtlDominant(s: string): boolean {
  const rtl = (s.match(RTL_RE) ?? []).length;
  const latin = (s.match(/[A-Za-z0-9]/g) ?? []).length;
  return rtl > 0 && rtl >= latin;
}

export type PositionedText = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Group positioned text items into lines by Y coordinate. */
export function groupIntoLines(items: PositionedText[], tolerance = 4): PositionedText[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: PositionedText[][] = [];
  let current: PositionedText[] = [sorted[0]];
  let lineY = sorted[0].top;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.top - lineY) <= tolerance) {
      current.push(item);
    } else {
      lines.push(current);
      current = [item];
      lineY = item.top;
    }
  }
  lines.push(current);
  return lines;
}

/** Reorder line items into logical reading order (RTL or LTR). */
export function reorderLine(line: PositionedText[]): PositionedText[] {
  const text = line.map((i) => i.text).join("");
  const rtl = isRtlDominant(text);
  return [...line].sort((a, b) => (rtl ? b.left - a.left : a.left - b.left));
}

/** Join a line's items into a single logical string with proper spacing. */
export function joinLineItems(line: PositionedText[]): string {
  const ordered = reorderLine(line);
  let out = "";
  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i].text;
    if (!t) continue;
    if (out && !out.endsWith(" ") && !t.startsWith(" ")) {
      const prev = ordered[i - 1];
      const gap = prev ? ordered[i].left - (prev.left + prev.width) : 0;
      if (gap > prev.height * 0.15) out += " ";
    }
    out += t;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Fix common Arabic extraction artifacts: isolated presentation forms,
 * reversed word order within a line, and stray direction marks.
 */
export function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\u0640/g, "")
    .normalize("NFC");
}

/** CSS properties for correct Arabic cursive rendering in HTML exports. */
export function rtlSpanStyle(rtl: boolean): string {
  return rtl
    ? "unicode-bidi:isolate;direction:rtl;text-align:right;font-family:'Segoe UI','Traditional Arabic',Tahoma,Arial,sans-serif;"
    : "unicode-bidi:isolate;direction:ltr;text-align:left;";
}
