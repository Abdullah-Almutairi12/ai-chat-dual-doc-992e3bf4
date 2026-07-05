export type PdfDocument = {
  id: string;
  name: string;
  sizeKb: number;
  uploadedAt: number;
  tool: string;
};

const STORAGE_KEY = "pdfquanta-docs";

function read(): PdfDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PdfDocument[]) : [];
  } catch {
    return [];
  }
}

function write(docs: PdfDocument[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  window.dispatchEvent(new Event("pdfquanta-docs-changed"));
}

export function getDocuments(): PdfDocument[] {
  return read().sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function addDocument(name: string, sizeKb: number, tool: string): PdfDocument {
  const doc: PdfDocument = {
    id: crypto.randomUUID(),
    name,
    sizeKb,
    uploadedAt: Date.now(),
    tool,
  };
  write([doc, ...read()].slice(0, 30));
  return doc;
}

export function deleteDocument(id: string) {
  write(read().filter((d) => d.id !== id));
}
