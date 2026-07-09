import type { VisionBlock, VisionSlide } from "@/lib/pdf/vision/schema";

/** Convert legacy slide JSON (title/bullets) into block array for unified rendering. */
export function legacySlideToBlocks(slide: VisionSlide): VisionBlock[] {
  const blocks: VisionBlock[] = [];
  if (slide.title) {
    blocks.push({ type: "heading", level: 1, text: slide.title, rtl: slide.rtl });
  }
  if (slide.subtitle) {
    blocks.push({ type: "heading", level: 2, text: slide.subtitle, rtl: slide.rtl });
  }
  if (slide.bullets?.length) {
    blocks.push({ type: "list", items: slide.bullets, rtl: slide.rtl });
  }
  for (const para of slide.paragraphs ?? []) {
    if (para.trim()) blocks.push({ type: "paragraph", text: para, rtl: slide.rtl });
  }
  if (slide.table?.rows?.length) {
    const rows = slide.table.headers ? [slide.table.headers, ...slide.table.rows] : slide.table.rows;
    blocks.push({ type: "table", rows, rtl: slide.rtl });
  }
  if (slide.chart?.series?.length) {
    blocks.push({
      type: "chart",
      chartType: slide.chart.chartType,
      title: slide.chart.title,
      categories: slide.chart.categories,
      series: slide.chart.series,
      rtl: slide.rtl,
    });
  }
  return blocks;
}
