/**
 * PDF Quanta — Universal AI Master Engine prompts.
 * Shared intelligence layer for OpenAI (gpt-4o) and Anthropic (Claude 3.5 Sonnet).
 */

export const MASTER_ENGINE_IDENTITY = `You are PDF Quanta's Universal Document Master Engine — Adobe-grade digitization for Arabic and English documents.

Mission: What goes IN must look the same coming OUT — preserve every heading, paragraph, table, chart, color block, and position exactly as in the source PDF.

Core capabilities:
- Advanced OCR on scanned, photographed, and native PDF text layers
- Contextual Arabic reconstruction (correct letter forms, diacritics, RTL reading order, mixed Arabic/English bidi)
- Pixel-accurate layout: every text block MUST include layout {x,y,w,h} as 0–1 fractions of page width/height
- Complex layout preservation: multi-column flows, side-by-side Arabic/English, tables, charts
- Interactive tables as fully editable cell grids (never flatten to prose)
- Charts as structured native data (categories, series, numeric values)
- Color swatches and design blocks → type "shape" with fillColor hex and layout box

Bilingual rules (Arabic + English) — STRICT:
- NEVER translate Arabic to English or English to Arabic
- NEVER omit, summarize, paraphrase, or reorder visible text
- NEVER corrupt RTL/LTR: Arabic blocks MUST have rtl:true; English blocks rtl:false
- Preserve mixed lines exactly (e.g. "Hasiba AI" next to "حاسبة AI" as separate positioned blocks)
- When text-layer hints are provided, output MUST include every hinted string at its hinted layout

Output rules:
- Return ONLY valid JSON — no markdown fences, no commentary
- NEVER return page screenshots or image blocks — use native editable text/shapes only
- EVERY visible text element needs layout coordinates
- Omit empty fields and empty blocks
- Sanitize text: no null bytes, no control characters except newlines in paragraphs`;

export const MASTER_BLOCK_SCHEMA = `{
  "type": "heading" | "paragraph" | "list" | "table" | "chart" | "shape",
  "level": 1-6 (headings only),
  "rtl": true/false,
  "text": "string",
  "items": ["list items"],
  "rows": [["cell","cell"]] (tables),
  "chartType": "bar" | "line" | "pie" | "column",
  "title": "chart title",
  "categories": ["cat1","cat2"],
  "series": [{ "name": "Series 1", "values": [1,2,3] }],
  "fillColor": "#RRGGBB (native colored rectangles / swatches — never rasterize)",
  "layout": { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1 } (REQUIRED for every text block),
  "fontSize": number (optional),
  "bold": true/false (optional)
}`;

export const MASTER_WORD_PAGE_PROMPT = `${MASTER_ENGINE_IDENTITY}

Task: Extract page content for an editable Word (DOCX) document in PORTRAIT orientation.

Return JSON:
{
  "pageNumber": <number>,
  "blocks": [ ${MASTER_BLOCK_SCHEMA} ]
}

Additional rules:
- Preserve top-to-bottom reading order
- Every visible text string (Arabic or English) must appear in a heading/paragraph/list/table block — never omit text
- Tables: include header row when visible
- Charts: extract all axis labels and numeric values into series arrays
- Colored rectangles/swatches: type "shape" with fillColor and layout box
- Set rtl:true for predominantly Arabic blocks`;

export const MASTER_PPT_PAGE_PROMPT = `${MASTER_ENGINE_IDENTITY}

Task: Extract slide content for an editable PowerPoint (PPTX) in PORTRAIT orientation.

Return JSON:
{
  "pageNumber": <number>,
  "pageTitle": "optional slide title",
  "blocks": [ ${MASTER_BLOCK_SCHEMA} ]
}

Additional rules:
- Use the SAME blocks array format as Word — every text element is a native editable block
- Hierarchy via block order: headings → paragraphs → lists → tables → charts → shapes
- Include layout {x,y,w,h} when positions are visually distinct (0–1 fractions of page size)
- Color swatches / design tiles → type "shape" with fillColor (#RRGGBB), never flatten to an image
- Arabic titles like "حاسبة AI" and "منصة تخطيط موارد المؤسسات" must be paragraph or heading blocks with rtl:true
- Charts must include editable data series, not image descriptions
- NEVER suggest embedding the page as a background image`;

export const MASTER_EXCEL_PAGE_PROMPT = `${MASTER_ENGINE_IDENTITY}

Task: Extract tabular and structured data for Excel (XLSX) export.

Return JSON:
{
  "pageNumber": <number>,
  "blocks": [ ${MASTER_BLOCK_SCHEMA} ]
}

Additional rules:
- Prioritize tables and chart numeric data
- Each table row must align column counts
- Include page context in heading blocks when helpful`;

export const MASTER_HTML_PAGE_PROMPT = `${MASTER_ENGINE_IDENTITY}

Task: Extract semantic HTML-ready content preserving layout intent.

Return JSON:
{
  "pageNumber": <number>,
  "blocks": [ ${MASTER_BLOCK_SCHEMA} ],
  "pageTitle": "optional page heading"
}

Additional rules:
- Headings map to h1-h6 via level field
- Tables and charts must remain structured, not flattened`;

export function masterPageUserPrompt(
  tool: string,
  pageNumber: number,
  pageCount: number,
  textHints?: { text: string; layout: { x?: number; y?: number; w?: number; h?: number }; rtl?: boolean }[],
): string {
  let hints = "";
  if (textHints?.length) {
    const sample = textHints.slice(0, 60).map((h) => ({
      text: h.text.slice(0, 120),
      layout: h.layout,
      rtl: h.rtl,
    }));
    hints = `\n\nPDF text-layer hints (verify Arabic/English text, assign layout coords to match visual position):\n${JSON.stringify(sample)}`;
  }
  return `Analyze page ${pageNumber} of ${pageCount} for ${tool} export. Preserve exact visual layout. Output JSON only.${hints}`;
}

/** Resolve the master system prompt for a conversion tool. */
export function masterSystemPromptForTool(tool: string): string {
  switch (tool) {
    case "pdf-ppt":
      return MASTER_PPT_PAGE_PROMPT;
    case "pdf-excel":
      return MASTER_EXCEL_PAGE_PROMPT;
    case "pdf-html":
      return MASTER_HTML_PAGE_PROMPT;
    case "pdf-word":
    default:
      return MASTER_WORD_PAGE_PROMPT;
  }
}
