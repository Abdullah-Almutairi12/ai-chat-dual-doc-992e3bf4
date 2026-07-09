import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import type { VisionBlock, VisionPage } from "@/lib/pdf/vision/schema";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockToHtml(block: VisionBlock): string {
  const rtl = block.rtl ?? isRtlDominant(block.text ?? "");
  const dir = rtl ? ' dir="rtl"' : "";

  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, block.level ?? 2));
      const text = escapeHtml(normalizeArabicText(block.text ?? ""));
      return text ? `<h${level}${dir}>${text}</h${level}>` : "";
    }
    case "paragraph": {
      const text = escapeHtml(normalizeArabicText(block.text ?? ""));
      return text ? `<p${dir}>${text}</p>` : "";
    }
    case "list": {
      const items = (block.items ?? []).map((i) => `<li>${escapeHtml(normalizeArabicText(i))}</li>`).join("");
      return items ? `<ul${dir}>${items}</ul>` : "";
    }
    case "table": {
      const rows = block.rows ?? [];
      if (!rows.length) return "";
      const body = rows
        .map(
          (row, ri) =>
            `<tr>${row.map((c) => (ri === 0 ? `<th>${escapeHtml(normalizeArabicText(c))}</th>` : `<td>${escapeHtml(normalizeArabicText(c))}</td>`)).join("")}</tr>`,
        )
        .join("");
      return `<table${dir} border="1" cellpadding="4">${body}</table>`;
    }
    case "chart": {
      const title = block.title ? `<caption>${escapeHtml(normalizeArabicText(block.title))}</caption>` : "";
      const cats = block.categories ?? [];
      const series = block.series ?? [];
      if (!cats.length || !series.length) return "";
      const header = `<tr><th>Category</th>${series.map((s) => `<th>${escapeHtml(normalizeArabicText(s.name))}</th>`).join("")}</tr>`;
      const body = cats
        .map(
          (cat, i) =>
            `<tr><td>${escapeHtml(normalizeArabicText(cat))}</td>${series.map((s) => `<td>${s.values[i] ?? ""}</td>`).join("")}</tr>`,
        )
        .join("");
      return `<table class="chart-data"${dir}>${title}${header}${body}</table>`;
    }
    default:
      return "";
  }
}

/** Build semantic HTML from Master Engine pages (portrait-friendly). */
export async function buildHtmlFromVisionPages(pages: VisionPage[], title = "Document"): Promise<Buffer> {
  const sections = pages
    .map((page) => {
      const heading = page.pageTitle
        ? `<h2>${escapeHtml(normalizeArabicText(page.pageTitle))}</h2>`
        : `<h2>Page ${page.pageNumber}</h2>`;
      const body = page.blocks.map(blockToHtml).filter(Boolean).join("\n");
      return `<section class="page">${heading}${body || "<p>&nbsp;</p>"}</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="auto">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, "Traditional Arabic", sans-serif; max-width: 816px; margin: 0 auto; padding: 24px; }
  section.page { page-break-after: always; margin-bottom: 2rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; }
</style>
</head>
<body>
${sections || "<p>PDF Quanta</p>"}
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}
