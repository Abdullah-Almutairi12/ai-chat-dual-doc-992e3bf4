import { normalizeArabicText } from "@/lib/pdf/bidi";
import { finalizeOfficeBuffer } from "@/lib/pdf/vision/response.server";
import type { VisionBlock, VisionPage } from "@/lib/pdf/vision/schema";

type SheetCell = string | number;

/** Convert a single block into real spreadsheet rows — tables/charts stay multi-column grids. */
function blockToRows(block: VisionBlock): SheetCell[][] {
  switch (block.type) {
    case "heading":
    case "paragraph": {
      const text = normalizeArabicText(block.text ?? "");
      return text ? [[text]] : [];
    }
    case "list":
      return (block.items ?? []).map((i) => normalizeArabicText(i)).filter(Boolean).map((i) => [i]);
    case "table": {
      const rows = block.rows ?? [];
      return rows.map((row) => row.map((cell) => normalizeArabicText(cell)));
    }
    case "chart": {
      const out: SheetCell[][] = [];
      if (block.title) out.push([normalizeArabicText(block.title)]);
      const categories = (block.categories ?? []).map((c) => normalizeArabicText(c));
      const series = block.series ?? [];
      if (categories.length && series.length) {
        out.push(["", ...series.map((s) => normalizeArabicText(s.name))]);
        categories.forEach((cat, i) => {
          out.push([cat, ...series.map((s) => (Number.isFinite(s.values[i]) ? s.values[i] : 0))]);
        });
      }
      return out;
    }
    case "shape": {
      const text = block.text ? normalizeArabicText(block.text) : "";
      return text ? [[text]] : [];
    }
    default:
      return [];
  }
}

function colCount(rows: SheetCell[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/** Build XLSX from Master Engine page blocks — one sheet per page, real multi-column grids. */
export async function buildXlsxFromVisionPages(pages: VisionPage[]): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  let sheetsAdded = 0;

  for (const page of pages) {
    const sheetRows: SheetCell[][] = [];
    if (page.pageTitle) sheetRows.push([normalizeArabicText(page.pageTitle)]);

    for (const block of page.blocks) {
      const rows = blockToRows(block);
      if (!rows.length) continue;
      // Blank separator row before each new block (skipped for the very first block),
      // so tables/paragraphs stay visually distinct without merging into each other.
      if (sheetRows.length) sheetRows.push([]);
      sheetRows.push(...rows);
    }

    if (!sheetRows.length) continue;

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    const widthCols = colCount(sheetRows);
    ws["!cols"] = Array.from({ length: Math.max(widthCols, 1) }, () => ({ wch: 28 }));

    const rawName = page.pageTitle?.trim() ? `${page.pageNumber}. ${page.pageTitle.trim()}` : `Page ${page.pageNumber}`;
    const safeName = rawName.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || `Page ${page.pageNumber}`;
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    sheetsAdded += 1;
  }

  if (!sheetsAdded) {
    const ws = XLSX.utils.aoa_to_sheet([["PDF Quanta"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Extracted");
  }

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  return finalizeOfficeBuffer(Buffer.from(out));
}
