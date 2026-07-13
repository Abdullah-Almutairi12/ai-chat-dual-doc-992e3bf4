import { isRtlDominant, normalizeArabicText } from "@/lib/pdf/bidi";
import { sortBlocksByLayout } from "@/lib/pdf/vision/fusion.server";
import type { FidelityPageRender } from "@/lib/pdf/vision/build-pptx.server";
import type { VisionBlock, VisionPage } from "@/lib/pdf/vision/schema";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockToPositionedHtml(block: VisionBlock): string {
  const rtl = block.rtl ?? isRtlDominant(block.text ?? "");
  const dir = rtl ? ' dir="rtl"' : "";
  const layout = block.layout;
  const style = layout
    ? `position:absolute;left:${((layout.x ?? 0) * 100).toFixed(2)}%;top:${((layout.y ?? 0) * 100).toFixed(2)}%;width:${((layout.w ?? 1) * 100).toFixed(2)}%;`
    : "position:relative;margin:8px 0;";

  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, block.level ?? 2));
      const text = escapeHtml(normalizeArabicText(block.text ?? ""));
      return text ? `<h${level}${dir} class="blk" style="${style}">${text}</h${level}>` : "";
    }
    case "paragraph": {
      const text = escapeHtml(normalizeArabicText(block.text ?? ""));
      return text ? `<p${dir} class="blk" style="${style}">${text}</p>` : "";
    }
    case "list": {
      const items = (block.items ?? []).map((i) => `<li>${escapeHtml(normalizeArabicText(i))}</li>`).join("");
      return items ? `<ul${dir} class="blk" style="${style}">${items}</ul>` : "";
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
      return `<table${dir} class="blk" style="${style}" border="1" cellpadding="4">${body}</table>`;
    }
    case "shape": {
      const fill = (block.fillColor ?? "").replace(/^#/, "");
      const label = escapeHtml(normalizeArabicText(block.text ?? ""));
      const bg = fill ? `background:#${fill};` : "";
      return `<div class="blk shape"${dir} style="${style}${bg}">${label || "&nbsp;"}</div>`;
    }
    default: {
      const text = escapeHtml(normalizeArabicText(block.text ?? ""));
      return text ? `<p${dir} class="blk" style="${style}">${text}</p>` : "";
    }
  }
}

/** Build pixel-faithful HTML from Master Engine pages (Adobe-style layout). */
export async function buildHtmlFromVisionPages(
  pages: VisionPage[],
  title = "Document",
  renders?: FidelityPageRender[],
): Promise<Buffer> {
  const sections = pages
    .map((page) => {
      const render = renders?.find((r) => r.pageNumber === page.pageNumber);
      const bg = render
        ? `<img class="page-bg" src="data:image/png;base64,${render.base64}" alt="Page ${page.pageNumber}"/>`
        : "";
      const body = sortBlocksByLayout(page.blocks).map(blockToPositionedHtml).filter(Boolean).join("\n");
      const heading = page.pageTitle
        ? `<h2 class="page-title">${escapeHtml(normalizeArabicText(page.pageTitle))}</h2>`
        : "";
      return `<section class="page">${bg}<div class="layer">${heading}${body || "<p>&nbsp;</p>"}</div></section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="auto">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, "Traditional Arabic", Arial, sans-serif; margin: 0; background: #525659; padding: 24px 0; }
  section.page { position: relative; width: 816px; min-height: 1056px; margin: 0 auto 24px; background: #fff; box-shadow: 0 6px 24px rgba(0,0,0,.35); page-break-after: always; overflow: hidden; }
  .page-bg { position: absolute; inset: 0; width: 100%; height: auto; z-index: 0; }
  .layer { position: relative; z-index: 1; min-height: 1056px; }
  .page-title { margin: 16px; }
  .blk { box-sizing: border-box; unicode-bidi: isolate; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; }
</style>
</head>
<body>
${sections || "<p>PDF Quanta</p>"}
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}
