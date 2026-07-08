import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import type { VisionSlide } from "@/lib/pdf/vision/schema";

function rtlFor(text: string, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return isRtlDominant(text);
}

/** Build an editable PPTX from Vision-structured slides (native text, not flat images). */
export async function buildPptxFromVisionSlides(slides: VisionSlide[]): Promise<Buffer> {
  const pptxModule = await import("pptxgenjs");
  const PptxGenJS = pptxModule.default as typeof import("pptxgenjs").default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    const rtl = slideData.rtl ?? rtlFor(slideData.title ?? slideData.bullets?.[0] ?? "");
    let y = 0.4;

    if (slideData.title) {
      slide.addText(normalizeArabicText(slideData.title), {
        x: 0.5,
        y,
        w: 9,
        h: 0.8,
        fontSize: 28,
        bold: true,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 1;
    }

    if (slideData.subtitle) {
      slide.addText(normalizeArabicText(slideData.subtitle), {
        x: 0.5,
        y,
        w: 9,
        h: 0.6,
        fontSize: 18,
        color: "666666",
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 0.8;
    }

    const bullets = (slideData.bullets ?? []).map((b) => normalizeArabicText(b)).filter(Boolean);
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true } })),
        {
          x: 0.7,
          y,
          w: 8.5,
          h: 4,
          fontSize: 16,
          align: rtl ? "right" : "left",
          rtlMode: rtl,
          fontFace: rtl ? "Traditional Arabic" : "Calibri",
        },
      );
      y += Math.min(3.5, bullets.length * 0.45);
    }

    const paragraphs = (slideData.paragraphs ?? []).map((p) => normalizeArabicText(p)).filter(Boolean);
    for (const para of paragraphs) {
      slide.addText(para, {
        x: 0.7,
        y,
        w: 8.5,
        h: 1.2,
        fontSize: 14,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
        fontFace: rtl ? "Traditional Arabic" : "Calibri",
      });
      y += 1.1;
    }

    if (slideData.table?.rows?.length) {
      const headers = slideData.table.headers ?? slideData.table.rows[0];
      const bodyRows = slideData.table.headers
        ? slideData.table.rows
        : slideData.table.rows.slice(1);
      const tableRows: string[][] = headers ? [headers, ...bodyRows] : bodyRows;
      slide.addTable(tableRows, {
        x: 0.5,
        y: Math.min(y, 5),
        w: 9,
        fontSize: 12,
        align: rtl ? "right" : "left",
        rtlMode: rtl,
      });
    }

    if (slideData.notes) {
      slide.addNotes(normalizeArabicText(slideData.notes));
    }
  }

  if (!slides.length) {
    const slide = pptx.addSlide();
    slide.addText("PDF Quanta — Vision export (no slides detected)", {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1,
      fontSize: 18,
    });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(out as ArrayBuffer);
}
