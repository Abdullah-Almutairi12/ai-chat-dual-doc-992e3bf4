import { normalizeArabicText } from "@/lib/pdf/bidi";
import type { VisionBlock, VisionPage } from "@/lib/pdf/vision/schema";

function blockToText(block: VisionBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return normalizeArabicText(block.text ?? "");
    case "list":
      return (block.items ?? []).map(normalizeArabicText).join("\n");
    case "table":
      return (block.rows ?? []).map((row) => row.map(normalizeArabicText).join("\t")).join("\n");
    case "chart": {
      const lines: string[] = [];
      if (block.title) lines.push(block.title);
      const cats = block.categories ?? [];
      for (const s of block.series ?? []) {
        lines.push(`${s.name}: ${cats.map((c, i) => `${c}=${s.values[i] ?? 0}`).join(", ")}`);
      }
      return lines.join("\n");
    }
    default:
      return "";
  }
}

/** Build XLSX from Master Engine page blocks (one row per block). */
export async function buildXlsxFromVisionPages(pages: VisionPage[]): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const rows: string[][] = [["Page", "Block Type", "Content"]];

  for (const page of pages) {
    for (const block of page.blocks) {
      const content = blockToText(block);
      if (content) rows.push([String(page.pageNumber), block.type, content]);
    }
    if (!page.blocks.length) {
      rows.push([String(page.pageNumber), "empty", ""]);
    }
  }

  if (rows.length === 1) {
    rows.push(["1", "paragraph", "PDF Quanta"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extracted");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out);
}
