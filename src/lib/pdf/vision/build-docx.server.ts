import { normalizeArabicText } from "@/lib/pdf/bidi";
import { blockRtl, fontFor, stripHexColor } from "@/lib/pdf/vision/block-layout.server";
import { sortBlocksByLayout } from "@/lib/pdf/vision/fusion.server";
import type { FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import { finalizeOfficeBuffer } from "@/lib/pdf/vision/response.server";
import type { VisionBlock, VisionChart, VisionPage } from "@/lib/pdf/vision/schema";

/** STRICT: this module must never embed raster page images — editable native content only. */
const FORBID_PAGE_IMAGES = true as const;

function assertNoImageEmbed(): void {
  if (!FORBID_PAGE_IMAGES) {
    throw new Error("Page image embedding is forbidden in Master Engine DOCX builder");
  }
}

function chartToTableRows(chart: VisionChart): string[][] {
  const rows: string[][] = [];
  if (chart.title) rows.push([chart.title]);
  const categories = chart.categories ?? [];
  const series = chart.series ?? [];
  if (categories.length && series.length) {
    rows.push(["Category", ...series.map((s) => s.name)]);
    categories.forEach((cat, i) => {
      rows.push([cat, ...series.map((s) => String(s.values[i] ?? ""))]);
    });
  }
  return rows;
}

function defaultFontSize(block: VisionBlock): number {
  if (block.fontSize) return block.fontSize * 2;
  switch (block.type) {
    case "heading":
      return block.level === 1 ? 32 : block.level === 2 ? 28 : 24;
    case "paragraph":
      return 22;
    case "list":
      return 22;
    default:
      return 20;
  }
}

/** Build portrait-oriented editable DOCX with layout-aware spacing. */
export async function buildDocxFromVisionPages(
  pages: VisionPage[],
  _renders?: FidelityPageRender[],
): Promise<Buffer> {

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    PageOrientation,
    ShadingType,
  } = await import("docx");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (pages[i].pageTitle) {
      const title = normalizeArabicText(pages[i].pageTitle!);
      const rtl = blockRtl({ type: "heading", text: title });
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text: title,
              rightToLeft: rtl,
              font: fontFor(rtl),
              bold: true,
            }),
          ],
        }),
      );
    }
    for (const block of sortBlocksByLayout(pages[i].blocks)) {
      children.push(
        ...blockToDocxElements(block, {
          Paragraph,
          TextRun,
          AlignmentType,
          HeadingLevel,
          Table,
          TableRow,
          TableCell,
          WidthType,
          ShadingType,
        }),
      );
    }
    if (i < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  if (!children.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "PDF Quanta" })],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
  return finalizeOfficeBuffer(await Packer.toBuffer(doc));
}

function blockToDocxElements(
  block: VisionBlock,
  docx: Pick<
    typeof import("docx"),
    | "Paragraph"
    | "TextRun"
    | "AlignmentType"
    | "HeadingLevel"
    | "Table"
    | "TableRow"
    | "TableCell"
    | "WidthType"
    | "ShadingType"
  >,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  assertNoImageEmbed();
  const { Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } =
    docx;

  if (block.type === "chart") {
    const rows = chartToTableRows(block);
    if (!rows.length) return [];
    block = { type: "table", rows, rtl: block.rtl };
  }

  switch (block.type) {
    case "shape": {
      const fill = stripHexColor(block.fillColor);
      const label = block.text ? normalizeArabicText(block.text) : " ";
      const rtl = blockRtl(block);
      const sizeHalfPoints = defaultFontSize(block);
      return [
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.CENTER,
          bidirectional: rtl,
          spacing: { before: 80, after: 80 },
          shading: fill
            ? { fill, type: ShadingType.CLEAR, color: "auto" }
            : undefined,
          indent: block.layout?.x != null ? { left: Math.round(block.layout.x * 7200) } : undefined,
          children: [
            new TextRun({
              text: label,
              rightToLeft: rtl,
              font: fontFor(rtl),
              size: sizeHalfPoints,
              bold: block.bold ?? false,
            }),
          ],
        }),
      ];
    }
    case "heading": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) return [];
      const rtl = blockRtl(block);
      const level = block.level ?? 1;
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return [
        new Paragraph({
          heading,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: fontFor(rtl),
              bold: block.bold ?? true,
              size: defaultFontSize(block),
            }),
          ],
        }),
      ];
    }
    case "paragraph": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) return [];
      const rtl = blockRtl(block);
      return [
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: fontFor(rtl),
              size: defaultFontSize(block),
              bold: block.bold ?? false,
            }),
          ],
        }),
      ];
    }
    case "list": {
      const items = (block.items ?? []).map((item) => normalizeArabicText(item)).filter(Boolean);
      if (!items.length) return [];
      return items.map((item) => {
        const rtl = blockRtl({ ...block, text: item });
        return new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text: `• ${item}`,
              rightToLeft: rtl,
              font: fontFor(rtl),
              size: defaultFontSize(block),
            }),
          ],
        });
      });
    }
    case "table": {
      const rows = block.rows ?? [];
      if (!rows.length) return [];
      const tableRows = rows.map(
        (row) =>
          new TableRow({
            children: row.map((cell) => {
              const text = normalizeArabicText(cell);
              const rtl = blockRtl({ ...block, text: cell });
              return new TableCell({
                width: { size: 100 / Math.max(row.length, 1), type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    bidirectional: rtl,
                    children: [
                      new TextRun({
                        text,
                        rightToLeft: rtl,
                        font: fontFor(rtl),
                      }),
                    ],
                  }),
                ],
              });
            }),
          }),
      );
      return [new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })];
    }
    default:
      return [];
  }
}
