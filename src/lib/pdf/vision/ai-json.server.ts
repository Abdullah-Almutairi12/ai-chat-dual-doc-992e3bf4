/**
 * Clean and parse raw Vision AI text responses before schema validation.
 * Strips markdown fences, BOM, null bytes, and C0/C1 control characters that
 * corrupt OOXML XML inside Office ZIP packages.
 */

/** Remove bytes/chars that break JSON.parse or OOXML XML text nodes. */
export function cleanAiRawText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7F-\x9F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
}

/** Strip ```json fences and isolate the JSON object/array payload. */
export function extractJsonPayload(raw: string): string {
  let text = cleanAiRawText(raw);

  const fenced = text.match(/```(?:json|javascript|txt)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  } else {
    text = text.replace(/^```(?:json|javascript|txt)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }

  if (text.startsWith("{") || text.startsWith("[")) return text;

  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    return text.slice(objStart, objEnd + 1);
  }

  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    return text.slice(arrStart, arrEnd + 1);
  }

  return text;
}

/** Recursively sanitize every string leaf in parsed AI JSON. */
export function deepSanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\0/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7F-\x9F]/g, "")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      .replace(/^\uFEFF/, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitizeValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = deepSanitizeValue(child);
    }
    return out;
  }
  return value;
}

/** Parse AI response JSON after cleaning fences and control characters. */
export function parseAiJson(raw: string): unknown {
  const payload = extractJsonPayload(raw);
  const cleaned = cleanAiRawText(payload);
  try {
    return deepSanitizeValue(JSON.parse(cleaned));
  } catch {
    const relaxed = cleaned.replace(/,\s*([}\]])/g, "$1");
    return deepSanitizeValue(JSON.parse(relaxed));
  }
}
