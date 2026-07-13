/** Document history disabled — no local or server persistence. */
export type PdfDocument = {
  id: string;
  name: string;
  sizeKb: number;
  uploadedAt: number;
  tool: string;
};

export function getDocuments(): PdfDocument[] {
  return [];
}

export function addDocument(_name: string, _sizeKb: number, _tool: string): PdfDocument {
  return { id: "", name: "", sizeKb: 0, uploadedAt: 0, tool: "" };
}

export function deleteDocument(_id: string): void {
  /* no-op */
}
