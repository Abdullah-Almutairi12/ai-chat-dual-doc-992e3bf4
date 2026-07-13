import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import { VISION_RENDER_SCALE, type VisionBlock, type VisionLayout } from "@/lib/pdf/vision/schema";

export type TextLayerBox = {
  text: string;
  layout: VisionLayout;
  rtl: boolean;
  fontSize: number;
};

export type PageTextLayer = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  /** True when PDF has a native text layer (not scan-only). */
  hasTextLayer: boolean;
  boxes: TextLayerBox[];
};

const MIN_CHARS = 12;

function meaningfulLength(s: string): number {
  return s.replace(/\s+/g, "").length;
}

function toNormLayout(
  left: number,
  top: number,
  width: number,
  height: number,
  pageW: number,
  pageH: number,
): VisionLayout {
  return {
    x: Math.min(1, Math.max(0, left / pageW)),
    y: Math.min(1, Math.max(0, top / pageH)),
    w: Math.min(1, Math.max(0.02, width / pageW)),
    h: Math.min(1, Math.max(0.02, height / pageH)),
  };
}

/** Server-side PDF text positions — Adobe-style layout hints for Vision AI. */
export async function extractPdfTextLayers(
  pdfBytes: Uint8Array,
  scale = VISION_RENDER_SCALE,
): Promise<PageTextLayer[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableWorker: true,
  }).promise;

  const layers: PageTextLayer[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const pageW = viewport.width;
    const pageH = viewport.height;
    const content = await page.getTextContent();

    let raw = "";
    for (const item of content.items) {
      if ("str" in item) raw += item.str + " ";
    }
    const hasTextLayer = meaningfulLength(raw) >= MIN_CHARS;

    const rawBoxes: TextLayerBox[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(tx[1], tx[3]) || Math.abs(tx[3]) || 12;
      const left = tx[4];
      const top = tx[5] - fontHeight;
      const width = (item.width ?? 0) * viewport.scale || fontHeight * item.str.length * 0.45;
      const text = normalizeArabicText(item.str.trim());
      if (!text) continue;
      rawBoxes.push({
        text,
        layout: toNormLayout(left, top, width, fontHeight, pageW, pageH),
        rtl: isRtlDominant(text),
        fontSize: Math.round(Math.min(48, Math.max(8, fontHeight * 0.75))),
      });
    }

    rawBoxes.sort((a, b) => (a.layout.y ?? 0) - (b.layout.y ?? 0) || (a.layout.x ?? 0) - (b.layout.x ?? 0));

    layers.push({
      pageNumber: i,
      pageWidth: pageW,
      pageHeight: pageH,
      hasTextLayer,
      boxes: rawBoxes,
    });
  }

  return layers;
}

/** Turn text-layer boxes into editable Vision blocks (fallback when AI is sparse). */
export function textLayerToBlocks(layer: PageTextLayer): VisionBlock[] {
  return layer.boxes.map((box) => ({
    type: "paragraph" as const,
    text: box.text,
    rtl: box.rtl,
    layout: box.layout,
    fontSize: box.fontSize,
  }));
}
