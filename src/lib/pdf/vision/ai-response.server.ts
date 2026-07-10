/**
 * Clean raw Vision AI text responses before JSON.parse.
 * Strips markdown fences, BOM/null bytes, and stray prose around JSON payloads.
 */

/** Remove characters illegal in Office Open XML text nodes. */
export function sanitizeOfficeText(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // XML 1.0 valid chars (exclude surrogates)
    if (code === 0x9 || code === 0xa || code === 0xd) {
      out += value[i];
      continue;
    }
    if (code >= 0x20 && code <= 0xd7ff) {
      out += value[i];
      continue;
    }
    if (code >= 0xe000 && code <= 0xfffd) {
      out += value[i];
      continue;
    }
    if (code >= 0x10000 && code <= 0x10ffff) {
      out += value[i];
    }
  }
  return out.replace(/\uFEFF/g, "").trim();
}

/** @deprecated Use sanitizeOfficeText */
export const sanitizeText = sanitizeOfficeText;

/** Recursively sanitize every string leaf in parsed AI JSON. */
export function deepSanitizeAiValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeOfficeText(value);
  if (Array.isArray(value)) return value.map(deepSanitizeAiValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepSanitizeAiValue(v);
    }
    return out;
  }
  return value;
}

/** Strip markdown code fences and isolate the JSON object/array payload. */
export function cleanAiJsonPayload(raw: string): string {
  let s = raw
    .replace(/\uFEFF/g, "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim();

  // ```json ... ``` (multiline, optional language tag)
  const fenced = s.match(/```(?:json|javascript|js)?\s*\r?\n?([\s\S]*?)```/i);
  if (fenced?.[1]) {
    s = fenced[1].trim();
  } else if (s.startsWith("```")) {
    s = s.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
  }

  // Prose before/after JSON — extract outermost { ... }
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      s = s.slice(start, end + 1);
    }
  }

  return s.trim();
}

/** Parse AI JSON safely — never pass raw markdown/control bytes to builders. */
export function parseAiJsonResponse(raw: string): unknown {
  const cleaned = cleanAiJsonPayload(raw);
  if (!cleaned) {
    throw new Error("AI returned empty JSON payload");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (firstErr) {
    // Trailing commas / smart quotes — last-resort normalization
    const relaxed = cleaned
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    parsed = JSON.parse(relaxed);
    if (firstErr instanceof Error) {
      // parsed on second attempt
    }
  }

  return deepSanitizeAiValue(parsed);
}

/** Coerce common AI type mistakes before Zod validation. */
export function coerceAiPageObject(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  const num = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const pageNum = num(obj.pageNumber) ?? num(obj.slideNumber);
  if (pageNum != null) obj.pageNumber = Math.max(1, Math.floor(pageNum));

  if (!Array.isArray(obj.blocks)) obj.blocks = [];

  obj.blocks = (obj.blocks as unknown[]).map((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return block;
    const b = { ...(block as Record<string, unknown>) };
    if (typeof b.type === "string") b.type = b.type.toLowerCase().trim();
    if (typeof b.rtl === "string") b.rtl = b.rtl === "true" || b.rtl === "1";
    if (typeof b.bold === "string") b.bold = b.bold === "true" || b.bold === "1";
    const level = num(b.level);
    if (level != null) b.level = Math.min(6, Math.max(1, Math.floor(level)));
    const fontSize = num(b.fontSize);
    if (fontSize != null) b.fontSize = fontSize;
    if (Array.isArray(b.items)) {
      b.items = b.items.filter((i) => typeof i === "string" && i.trim());
    }
    if (Array.isArray(b.rows)) {
      b.rows = b.rows
        .filter((r) => Array.isArray(r))
        .map((r) => (r as unknown[]).map((c) => String(c ?? "")));
    }
    if (Array.isArray(b.series)) {
      b.series = (b.series as unknown[]).map((s) => {
        if (!s || typeof s !== "object") return s;
        const ser = { ...(s as Record<string, unknown>) };
        if (Array.isArray(ser.values)) {
          ser.values = ser.values.map((v) => {
            const n = num(v);
            return n ?? 0;
          });
        }
        return ser;
      });
    }
    return b;
  });

  return obj;
}
