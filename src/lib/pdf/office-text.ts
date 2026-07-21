/** Extract plain text from Office Open XML (docx/pptx) without corrupting binary via file.text(). */

function findEndOfCentralDirectory(data: Uint8Array): number {
  const sig = [0x50, 0x4b, 0x05, 0x06];
  for (let i = data.length - 22; i >= 0; i--) {
    if (sig.every((b, j) => data[i + j] === b)) return i;
  }
  return -1;
}

function readUint16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function inflateRaw(data: Uint8Array): Uint8Array | null {
  try {
    const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
    if (!DS) return null;
    // sync path unavailable — caller uses async below
    return null;
  } catch {
    return null;
  }
}

async function inflateRawAsync(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
    if (!DS) return null;
    const stream = new Blob([data]).stream().pipeThrough(new DS("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripXmlText(xml: string): string {
  return decodeXmlEntities(
    xml.replace(/<w:tab[^/]*\/>/g, "\t").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a Word body XML string into per-paragraph plain text (preserves line breaks). */
function splitDocxParagraphs(xml: string): string[] {
  const paragraphs: string[] = [];
  const re = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const text = stripXmlText(match[0]);
    paragraphs.push(text);
  }
  return paragraphs;
}

/** Split a PowerPoint slide XML string into per-text-run lines (title/bullets). */
function splitPptxSlideLines(xml: string): string[] {
  const lines: string[] = [];
  const re = /<a:p[ >][\s\S]*?<\/a:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const text = stripXmlText(match[0]);
    if (text) lines.push(text);
  }
  return lines;
}

function listZipEntryNames(data: Uint8Array): string[] {
  const eocd = findEndOfCentralDirectory(data);
  if (eocd < 0) return [];
  const cdCount = readUint16(data, eocd + 10);
  let offset = readUint32(data, eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < cdCount; i++) {
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b || data[offset + 2] !== 0x01 || data[offset + 3] !== 0x02) {
      break;
    }
    const nameLen = readUint16(data, offset + 28);
    const extraLen = readUint16(data, offset + 30);
    const commentLen = readUint16(data, offset + 32);
    const nameBytes = data.slice(offset + 46, offset + 46 + nameLen);
    names.push(new TextDecoder().decode(nameBytes));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

async function readZipEntry(data: Uint8Array, path: string): Promise<Uint8Array | null> {
  const eocd = findEndOfCentralDirectory(data);
  if (eocd < 0) return null;
  const cdCount = readUint16(data, eocd + 10);
  let offset = readUint32(data, eocd + 16);

  for (let i = 0; i < cdCount; i++) {
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b || data[offset + 2] !== 0x01 || data[offset + 3] !== 0x02) {
      break;
    }
    const compMethod = readUint16(data, offset + 10);
    const compSize = readUint32(data, offset + 20);
    const nameLen = readUint16(data, offset + 28);
    const extraLen = readUint16(data, offset + 30);
    const commentLen = readUint16(data, offset + 32);
    const localHeaderOffset = readUint32(data, offset + 42);
    const nameBytes = data.slice(offset + 46, offset + 46 + nameLen);
    const entryName = new TextDecoder().decode(nameBytes);

    if (entryName === path) {
      const lh = localHeaderOffset;
      const localNameLen = readUint16(data, lh + 26);
      const localExtraLen = readUint16(data, lh + 28);
      const fileStart = lh + 30 + localNameLen + localExtraLen;
      const compressed = data.slice(fileStart, fileStart + compSize);

      if (compMethod === 0) return compressed;
      if (compMethod === 8) {
        const inflated = inflateRaw(compressed) ?? (await inflateRawAsync(compressed));
        return inflated;
      }
      return null;
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** All paragraphs (in order) from a .docx's main document body. */
export async function extractDocxParagraphs(bytes: Uint8Array): Promise<string[]> {
  if (bytes.byteLength < 512 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return [];
  const entry = await readZipEntry(bytes, "word/document.xml");
  if (!entry) return [];
  return splitDocxParagraphs(new TextDecoder().decode(entry));
}

/** Text lines per slide (in slide order) from a .pptx — fixes the "first slide only" bug. */
export async function extractPptxSlideTexts(bytes: Uint8Array): Promise<string[][]> {
  if (bytes.byteLength < 512 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return [];

  const slideNumbers = listZipEntryNames(bytes)
    .map((name) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(name))
    .filter((m): m is RegExpExecArray => m != null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);

  const slides: string[][] = [];
  for (const n of slideNumbers) {
    const entry = await readZipEntry(bytes, `ppt/slides/slide${n}.xml`);
    if (!entry) continue;
    slides.push(splitPptxSlideLines(new TextDecoder().decode(entry)));
  }
  return slides;
}
