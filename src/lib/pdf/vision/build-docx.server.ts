import { normalizeArabicText } from "@/lib/pdf/bidi";
import { layoutToDocxTwips } from "@/lib/pdf/layout-fidelity";
import { blockRtl, fontFor, stripHexColor } from "@/lib/pdf/vision/block-layout.server";
import { sortBlocksByLayout } from "@/lib/pdf/vision/fusion.server";
import type { FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import { finalizeOfficeBuffer } from "@/lib/pdf/vision/response.server";
import type { VisionBlock, VisionChart, VisionPage } from "@/lib/pdf/vision/schema";

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

/** Build portrait DOCX with absolute-position paragraphs (Adobe-style). */
export async function buildDocxFromVisionPages(
  pages: VisionPage[],
  renders?: FidelityPageRender[],
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
  const sections: any[] = [];

  for (let i = 0; i < pages.length; i++) {
    const render = renders?.find((r) => r.pageNumber === pages[i].pageNumber);
    const scanned = render != null && !render.hasTextLayer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [];

    if (pages[i].pageTitle) {
      const title = normalizeArabicText(pages[i].pageTitle!);
      const rtl = blockRtl({ type: "heading", text: title });
      children.push(
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [new TextRun({ text: title, rightToLeft: rtl, font: fontFor(rtl), bold: true, size: 36 })],
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
        }, scanned),
      );
    }

    if (!children.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: " " })] }));
    }

    sections.push({
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT, width: 12240, height: 15840 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    });
  }

  const doc = new Document({ sections });
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
  scannedBackground = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const { Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } =
    docx;

  const pos = block.layout ? layoutToDocxTwips(block.layout) : null;
  const positionProps = pos
    ? {
        spacing: { before: pos.before, after: 40, line: 240 },
        indent: blockRtl(block)
          ? { right: pos.left, left: 0 }
          : { left: pos.left },
      }
    : { spacing: { after: 80 } };

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
          ...positionProps,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.CENTER,
          bidirectional: rtl,
          shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
          children: [
            new TextRun({
              text: label,
              rightToLeft: rtl,
              font: fontFor(rtl),
              size: sizeHalfPoints,
              bold: block.bold ?? false,
              color: scannedBackground ? "FFFFFF" : undefined,
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
          ...positionProps,
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
          ...positionProps,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: rtl,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: fontFor(rtl),
              size: defaultFontSize(block),
              bold: block.bold ?? false,
              color: scannedBackground ? "FFFFFF" : undefined,
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
