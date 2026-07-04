export type DocMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type PdfDocument = {
  id: string;
  name: string;
  sizeKb: number;
  uploadedAt: number;
  messages: DocMessage[];
};

const STORAGE_KEY = "pdf-assistant-docs";

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
  window.dispatchEvent(new Event("pdf-docs-changed"));
}

export function getDocuments(): PdfDocument[] {
  return read().sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function getDocument(id: string): PdfDocument | undefined {
  return read().find((d) => d.id === id);
}

export function addDocument(name: string, sizeKb: number): PdfDocument {
  const doc: PdfDocument = {
    id: crypto.randomUUID(),
    name,
    sizeKb,
    uploadedAt: Date.now(),
    messages: [],
  };
  write([...read(), doc]);
  return doc;
}

export function saveMessages(id: string, messages: DocMessage[]) {
  const docs = read();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) return;
  docs[idx] = { ...docs[idx], messages };
  write(docs);
}

export function deleteDocument(id: string) {
  write(read().filter((d) => d.id !== id));
}

const answersEn = [
  "Based on the document, the main point is that the approach delivers measurable improvements across the key metrics discussed.",
  "The document highlights three core themes: context, methodology, and outcomes — each supported by concrete examples.",
  "In summary, the author argues for a structured process and backs it with data from the referenced sections.",
  "Yes — the relevant section confirms this and provides additional detail in the following paragraphs.",
];

const answersAr = [
  "استنادًا إلى المستند، النقطة الرئيسية هي أن النهج يحقق تحسينات ملموسة عبر المقاييس الأساسية المذكورة.",
  "يبرز المستند ثلاثة محاور رئيسية: السياق والمنهجية والنتائج — كل منها مدعوم بأمثلة واضحة.",
  "باختصار، يدعو الكاتب إلى عملية منظّمة ويدعمها ببيانات من الأقسام المشار إليها.",
  "نعم — يؤكد القسم ذو الصلة ذلك ويقدّم تفاصيل إضافية في الفقرات التالية.",
];

export function mockAnswer(lang: "en" | "ar"): string {
  const pool = lang === "ar" ? answersAr : answersEn;
  return pool[Math.floor(Math.random() * pool.length)];
}