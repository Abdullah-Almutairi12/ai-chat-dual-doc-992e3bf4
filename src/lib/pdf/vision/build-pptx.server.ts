import { normalizeArabicText } from "@/lib/pdf/bidi";
import { normLayoutToInches } from "@/lib/pdf/layout-fidelity";
import {
  blockRtl,
  fontFor,
  layoutToInches,
  stripHexColor,
} from "@/lib/pdf/vision/block-layout.server";
import { sortBlocksByLayout } from "@/lib/pdf/vision/fusion.server";
import {
  PORTRAIT_CONTENT_W,
  PORTRAIT_HEIGHT_IN,
  PORTRAIT_LAYOUT_NAME,
  PORTRAIT_MARGIN_X,
  PORTRAIT_WIDTH_IN,
} from "@/lib/pdf/vision/layout-constants";
import { legacySlideToBlocks } from "@/lib/pdf/vision/legacy-slide.server";
import { finalizeOfficeBuffer } from "@/lib/pdf/vision/response.server";
import type { VisionBlock, VisionChart, VisionPage, VisionSlide } from "@/lib/pdf/vision/schema";

export type FidelityPageRender = {
  pageNumber: number;
  width: number;
  height: number;
  base64: string;
  /** When false (scanned page), embed page image behind editable text. */
  hasTextLayer: boolean;
};

function definePortraitLayout(pptx: import("pptxgenjs").default): void {
  pptx.defineLayout({
    name: PORTRAIT_LAYOUT_NAME,
    width: PORTRAIT_WIDTH_IN,
    height: PORTRAIT_HEIGHT_IN,
  });
  pptx.layout = PORTRAIT_LAYOUT_NAME;
}

function defaultFontSize(block: VisionBlock): number {
  if (block.fontSize) return block.fontSize;
  switch (block.type) {
    case "heading":
      return block.level === 1 ? 24 : block.level === 2 ? 20 : 16;
    case "paragraph":
      return 13;
    case "list":
      return 14;
    default:
      return 12;
  }
}

function addChartToSlide(
  slide: import("pptxgenjs").Slide,
  pptx: import("pptxgenjs").default,
  chart: VisionChart,
  box: { x: number; y: number; w: number; h: number },
  rtl: boolean,
): void {
  const categories = chart.categories ?? [];
  const series = chart.series ?? [];
  if (!categories.length || !series.length) return;

  const chartData = series.map((s) => ({
    name: normalizeArabicText(s.name),
    labels: categories.map(normalizeArabicText),
    values: s.values,
  }));

  const typeMap = {
    bar: pptx.charts.BAR,
    column: pptx.charts.BAR,
    line: pptx.charts.LINE,
    pie: pptx.charts.PIE,
  } as const;

  const chartType = typeMap[chart.chartType ?? "bar"] ?? pptx.charts.BAR;

  slide.addChart(chartType, chartData, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: Math.min(box.h, 3.5),
    showTitle: Boolean(chart.title),
    title: chart.title ? normalizeArabicText(chart.title) : undefined,
    showLegend: series.length > 1,
    legendPos: rtl ? "b" : "b",
  });
}

function renderBlockToSlide(
  slide: import("pptxgenjs").Slide,
  pptx: import("pptxgenjs").default,
  block: VisionBlock,
  flowY: number,
  scannedBackground: boolean,
): number {
  const rtl = blockRtl(block);
  const fontFace = fontFor(rtl);
  const box = block.layout?.x != null && block.layout?.y != null
    ? normLayoutToInches(block.layout)
    : layoutToInches(block.layout, flowY);
  let nextY = box.y;
  const invisibleOnScan = scannedBackground;

  switch (block.type) {
    case "shape": {
      const fill = stripHexColor(block.fillColor);
      if (fill) {
        slide.addShape(pptx.ShapeType.rect, {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fill: { color: fill },
          line: { type: "none" },
        });
      }
      const label = block.text ? normalizeArabicText(block.text) : "";
      if (label) {
        slide.addText(label, {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fontSize: block.fontSize ?? 11,
          bold: block.bold ?? false,
          align: rtl ? "right" : "center",
          valign: "middle",
          rtlMode: rtl,
          fontFace,
        });
      }
      nextY = box.y + box.h + 0.12;
      break;
    }
    case "heading": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) break;
      slide.addText(text, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fontSize: defaultFontSize(block),
        bold: block.bold ?? true,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace,
        ...(scannedBackground ? { color: "FFFFFF", transparency: 100 } : {}),
      });
      nextY = box.y + box.h + 0.1;
      break;
    }
    case "paragraph": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) break;
      slide.addText(text, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fontSize: defaultFontSize(block),
        bold: block.bold ?? false,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace,
        wrap: true,
        ...(scannedBackground ? { color: "FFFFFF", transparency: 100 } : {}),
      });
      nextY = box.y + box.h + 0.08;
      break;
    }
    case "list": {
      const items = (block.items ?? []).map((b) => normalizeArabicText(b)).filter(Boolean);
      if (!items.length) break;
      slide.addText(
        items.map((b) => ({ text: b, options: { bullet: true } })),
        {
          x: box.x + (rtl ? 0 : 0.15),
          y: box.y,
          w: box.w - 0.15,
          h: Math.min(box.h, PORTRAIT_HEIGHT_IN - box.y - 0.5),
          fontSize: defaultFontSize(block),
          align: rtl ? "right" : "left",
          rtlMode: rtl,
          fontFace,
        },
      );
      nextY = box.y + Math.min(box.h, items.length * 0.35 + 0.2);
      break;
    }
    case "table": {
      const rows = block.rows ?? [];
      if (!rows.length) break;
      slide.addTable(rows.map((row) => row.map((c) => normalizeArabicText(c))), {
        x: box.x,
        y: box.y,
        w: box.w,
        fontSize: 11,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
      });
      nextY = box.y + Math.max(box.h, 1.2);
      break;
    }
    case "chart": {
      addChartToSlide(
        slide,
        pptx,
        {
          chartType: block.chartType,
          title: block.title,
          categories: block.categories,
          series: block.series,
        },
        { x: box.x, y: box.y, w: box.w, h: Math.max(box.h, 3) },
        rtl,
      );
      nextY = box.y + 3.6;
      break;
    }
    default:
      break;
  }

  return Math.min(nextY, PORTRAIT_HEIGHT_IN - 0.4);
}

function pageToBlocks(page: VisionPage): VisionBlock[] {
  if (page.blocks.length) return page.blocks;
  return [];
}

/** Build portrait-oriented editable PPTX — Adobe-style layout fidelity. */
export async function buildPptxFromVisionPages(
  pages: VisionPage[],
  renders?: FidelityPageRender[],
): Promise<Buffer> {
  const pptxModule = await import("pptxgenjs");
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;
  const pptx = new PptxGenJS();
  definePortraitLayout(pptx);

  for (const pageData of pages) {
    const slide = pptx.addSlide();
    const render = renders?.find((r) => r.pageNumber === pageData.pageNumber);
    const scannedBackground = render != null && !render.hasTextLayer;

    if (render && scannedBackground) {
      slide.addImage({
        data: `image/png;base64,${render.base64}`,
        x: 0,
        y: 0,
        w: PORTRAIT_WIDTH_IN,
        h: PORTRAIT_HEIGHT_IN,
      });
    }

    const blocks = sortBlocksByLayout(pageToBlocks(pageData));
    let flowY = 0.5;

    if (pageData.pageTitle) {
      const rtl = blockRtl({ type: "heading", text: pageData.pageTitle });
      slide.addText(normalizeArabicText(pageData.pageTitle), {
        x: PORTRAIT_MARGIN_X,
        y: flowY,
        w: PORTRAIT_CONTENT_W,
        h: 0.65,
        fontSize: 22,
        bold: true,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: fontFor(rtl),
        ...(scannedBackground ? { color: "FFFFFF", transparency: 100 } : {}),
      });
      flowY += 0.75;
    }

    for (const block of blocks) {
      if (!block.layout?.y && flowY >= PORTRAIT_HEIGHT_IN - 0.5) break;
      flowY = renderBlockToSlide(slide, pptx, block, flowY, scannedBackground);
    }

    if (!blocks.length && !pageData.pageTitle) {
      slide.addText("PDF Quanta", {
        x: PORTRAIT_MARGIN_X,
        y: 4,
        w: PORTRAIT_CONTENT_W,
        h: 1,
        fontSize: 18,
        align: "center",
      });
    }
  }

  if (!pages.length) {
    const slide = pptx.addSlide();
    slide.addText("PDF Quanta", {
      x: PORTRAIT_MARGIN_X,
      y: 4,
      w: PORTRAIT_CONTENT_W,
      h: 1,
      fontSize: 18,
    });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  const raw = Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  return finalizeOfficeBuffer(raw);
}

/** @deprecated Use buildPptxFromVisionPages — slides are converted to blocks internally. */
export async function buildPptxFromVisionSlides(slides: VisionSlide[]): Promise<Buffer> {
  const pages: VisionPage[] = slides.map((s) => ({
    pageNumber: s.slideNumber,
    blocks: legacySlideToBlocks(s),
  }));
  return buildPptxFromVisionPages(pages);
}
