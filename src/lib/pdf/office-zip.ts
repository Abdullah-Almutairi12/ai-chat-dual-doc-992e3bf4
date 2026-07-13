/** Validate Office Open XML (ZIP) structure — rejects HTML/JSON/truncated archives. */

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

function findEndOfCentralDirectory(data: Uint8Array): number {
  for (let i = data.length - 22; i >= 0; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) return i;
  }
  return -1;
}

function readUint16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

export function listZipEntryNames(data: Uint8Array): string[] {
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

export function isZipBytes(data: Uint8Array): boolean {
  return data.byteLength >= 512 && ZIP_MAGIC.every((b, i) => data[i] === b);
}

/** Reject JSON/HTML error pages saved as Office files. */
export function looksLikeTextNotOffice(data: Uint8Array): boolean {
  if (data.byteLength < 4) return true;
  const b0 = data[0];
  return b0 === 0x7b || b0 === 0x3c || b0 === 0x5b; // { < [
}

const REQUIRED: Record<"docx" | "pptx" | "xlsx", string[]> = {
  pptx: ["[Content_Types].xml", "ppt/presentation.xml"],
  docx: ["[Content_Types].xml", "word/document.xml"],
  xlsx: ["[Content_Types].xml", "xl/workbook.xml"],
};

export function validateOfficeZipBytes(data: Uint8Array, kind: "docx" | "pptx" | "xlsx"): boolean {
  if (!isZipBytes(data) || looksLikeTextNotOffice(data)) return false;
  const names = new Set(listZipEntryNames(data));
  return REQUIRED[kind].every((entry) => names.has(entry));
}

export async function validateOfficeBlob(blob: Blob, kind: "docx" | "pptx" | "xlsx"): Promise<boolean> {
  const buf = new Uint8Array(await blob.slice(0, Math.min(blob.size, 512 * 1024)).arrayBuffer());
  return validateOfficeZipBytes(buf, kind);
}
