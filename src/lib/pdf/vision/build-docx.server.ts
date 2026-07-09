import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import type { VisionBlock, VisionChart, VisionPage } from "@/lib/pdf/vision/schema";

function rtlFor(text: string, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return isRtlDominant(text);
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

/** Build portrait-oriented editable DOCX from Master Engine pages. */
export async function buildDocxFromVisionPages(pages: VisionPage[]): Promise<Buffer> {
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
  } = await import("docx");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (pages[i].pageTitle) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: normalizeArabicText(pages[i].pageTitle!) })],
        }),
      );
    }
    for (const block of pages[i].blocks) {
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
  return Packer.toBuffer(doc);
}

function blockToDocxElements(
  block: VisionBlock,
  docx: Pick<
    typeof import("docx"),
    "Paragraph" | "TextRun" | "AlignmentType" | "HeadingLevel" | "Table" | "TableRow" | "TableCell" | "WidthType"
  >,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const { Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;

  if (block.type === "chart") {
    const rows = chartToTableRows(block);
    if (!rows.length) return [];
    block = { type: "table", rows, rtl: block.rtl };
  }

  switch (block.type) {
    case "heading": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) return [];
      const rtl = rtlFor(text, block.rtl);
      const level = block.level ?? 1;
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return [
        new Paragraph({
          heading,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: rtl ? "Traditional Arabic" : "Calibri",
              bold: true,
            }),
          ],
        }),
      ];
    }
    case "paragraph": {
      const text = normalizeArabicText(block.text ?? "");
      if (!text) return [];
      const rtl = rtlFor(text, block.rtl);
      return [
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: rtl ? "Traditional Arabic" : "Calibri",
            }),
          ],
        }),
      ];
    }
    case "list": {
      const items = (block.items ?? []).map((item) => normalizeArabicText(item)).filter(Boolean);
      if (!items.length) return [];
      return items.map((item) => {
        const rtl = rtlFor(item, block.rtl);
        return new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: `• ${item}`,
              rightToLeft: rtl,
              font: rtl ? "Traditional Arabic" : "Calibri",
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
            children: row.map(
              (cell) =>
                new TableCell({
                  width: { size: 100 / Math.max(row.length, 1), type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: normalizeArabicText(cell),
                          rightToLeft: rtlFor(cell, block.rtl),
                          font: rtlFor(cell, block.rtl) ? "Traditional Arabic" : "Calibri",
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
      );
      return [new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })];
    }
    default:
      return [];
  }
}
