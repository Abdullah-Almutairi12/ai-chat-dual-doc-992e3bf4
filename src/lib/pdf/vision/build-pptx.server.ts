import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import {
  PORTRAIT_CONTENT_W,
  PORTRAIT_HEIGHT_IN,
  PORTRAIT_LAYOUT_NAME,
  PORTRAIT_MARGIN_X,
  PORTRAIT_WIDTH_IN,
} from "@/lib/pdf/vision/layout-constants";
import type { VisionChart, VisionSlide } from "@/lib/pdf/vision/schema";

function rtlFor(text: string, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return isRtlDominant(text);
}

function definePortraitLayout(pptx: import("pptxgenjs").default): void {
  pptx.defineLayout({
    name: PORTRAIT_LAYOUT_NAME,
    width: PORTRAIT_WIDTH_IN,
    height: PORTRAIT_HEIGHT_IN,
  });
  pptx.layout = PORTRAIT_LAYOUT_NAME;
}

function addChartToSlide(
  slide: import("pptxgenjs").Slide,
  pptx: import("pptxgenjs").default,
  chart: VisionChart,
  y: number,
  rtl: boolean,
): number {
  const categories = chart.categories ?? [];
  const series = chart.series ?? [];
  if (!categories.length || !series.length) return y;

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
    x: PORTRAIT_MARGIN_X,
    y,
    w: PORTRAIT_CONTENT_W,
    h: 3.5,
    showTitle: Boolean(chart.title),
    title: chart.title ? normalizeArabicText(chart.title) : undefined,
    showLegend: series.length > 1,
    legendPos: rtl ? "b" : "b",
  });

  return y + 3.8;
}

/** Build portrait-oriented editable PPTX from Master Engine slides. */
export async function buildPptxFromVisionSlides(slides: VisionSlide[]): Promise<Buffer> {
  const pptxModule = await import("pptxgenjs");
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;
  const pptx = new PptxGenJS();
  definePortraitLayout(pptx);

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    const rtl = slideData.rtl ?? rtlFor(slideData.title ?? slideData.bullets?.[0] ?? "");
    let y = 0.5;

    if (slideData.title) {
      slide.addText(normalizeArabicText(slideData.title), {
        x: PORTRAIT_MARGIN_X,
        y,
        w: PORTRAIT_CONTENT_W,
        h: 0.7,
        fontSize: 24,
        bold: true,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 0.85;
    }

    if (slideData.subtitle) {
      slide.addText(normalizeArabicText(slideData.subtitle), {
        x: PORTRAIT_MARGIN_X,
        y,
        w: PORTRAIT_CONTENT_W,
        h: 0.5,
        fontSize: 16,
        color: "666666",
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 0.65;
    }

    const bullets = (slideData.bullets ?? []).map((b) => normalizeArabicText(b)).filter(Boolean);
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true } })),
        {
          x: PORTRAIT_MARGIN_X + 0.15,
          y,
          w: PORTRAIT_CONTENT_W - 0.15,
          h: Math.min(4, PORTRAIT_HEIGHT_IN - y - 1),
          fontSize: 14,
          align: rtl ? "right" : "left",
          rtlMode: rtl,
          fontFace: rtl ? "Traditional Arabic" : "Calibri",
        },
      );
      y += Math.min(3, bullets.length * 0.4);
    }

    const paragraphs = (slideData.paragraphs ?? []).map((p) => normalizeArabicText(p)).filter(Boolean);
    for (const para of paragraphs) {
      if (y > PORTRAIT_HEIGHT_IN - 1.5) break;
      slide.addText(para, {
        x: PORTRAIT_MARGIN_X + 0.15,
        y,
        w: PORTRAIT_CONTENT_W - 0.15,
        h: 0.9,
        fontSize: 13,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 0.95;
    }

    if (slideData.table?.rows?.length && y < PORTRAIT_HEIGHT_IN - 2) {
      const headers = slideData.table.headers;
      const bodyRows = slideData.table.rows;
      const tableRows: string[][] = headers ? [headers, ...bodyRows] : bodyRows;
      slide.addTable(tableRows, {
        x: PORTRAIT_MARGIN_X,
        y: Math.min(y, PORTRAIT_HEIGHT_IN - 2.5),
        w: PORTRAIT_CONTENT_W,
        fontSize: 11,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
      });
      y += 2;
    }

    if (slideData.chart?.series?.length && y < PORTRAIT_HEIGHT_IN - 4) {
      y = addChartToSlide(slide, pptx, slideData.chart, y, rtl);
    }

    if (slideData.notes) {
      slide.addNotes(normalizeArabicText(slideData.notes));
    }
  }

  if (!slides.length) {
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
  return Buffer.from(out as ArrayBuffer);
}
