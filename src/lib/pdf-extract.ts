/**
 * Client-side document text extraction with Arabic support.
 *
 * - Text-based PDFs: extracted with PDF.js in logical (reading) order. We never
 *   reverse characters or split ligatures — PDF.js returns Unicode in logical
 *   order and the browser's bidi engine renders it correctly when displayed
 *   with `dir="auto"`/`rtl`.
 * - Scanned / image-only PDF pages: rendered to a canvas and OCR'd with
 *   Tesseract.js using the Arabic + English traineddata (`ara+eng`).
 * - Standalone images (png/jpg/…): OCR'd directly.
 *
 * Everything runs in the browser (WASM), so it works on the edge runtime
 * (no native binaries required server-side).
 */

export type ExtractStage = "loading" | "parsing" | "ocr" | "done";

export type ExtractProgress = {
  stage: ExtractStage;
  page: number;
  pageCount: number;
  /** 0–100 overall progress estimate. */
  percent: number;
};

export type ExtractResult = {
  text: string;
  pageCount: number;
  /** How many pages needed OCR (were image-based / scanned). */
  ocrPageCount: number;
  usedOcr: boolean;
  /** True if the document reads right-to-left (Arabic-dominant). */
  isRtl: boolean;
};

type ProgressFn = (p: ExtractProgress) => void;

// A page is considered "scanned" (no real text layer) when the text layer
// yields fewer than this many meaningful characters.
const MIN_TEXT_CHARS = 12;
const OCR_LANGS = "ara+eng";

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

function meaningfulLength(s: string): number {
  return s.replace(/\s+/g, "").length;
}

function isRtlText(s: string): boolean {
  const arabic = (s.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  return arabic > 0 && arabic >= latin;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Vite resolves this to a hashed URL for the worker bundle.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** Reusable Tesseract worker so we only load the Arabic model once per doc. */
async function createOcrWorker(onLog?: (progress: number) => void) {
  const { createWorker } = await import("tesseract.js");
  return createWorker(OCR_LANGS, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onLog) onLog(m.progress);
    },
  });
}

/** Extract text from a single rendered page image via OCR. */
async function ocrCanvas(
  worker: Awaited<ReturnType<typeof createOcrWorker>>,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const { data } = await worker.recognize(canvas);
  return data.text ?? "";
}

/** OCR a standalone image file (png/jpg/webp/…). */
async function extractImage(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  onProgress?.({ stage: "ocr", page: 1, pageCount: 1, percent: 10 });
  const worker = await createOcrWorker((p) =>
    onProgress?.({ stage: "ocr", page: 1, pageCount: 1, percent: 20 + Math.round(p * 70) }),
  );
  try {
    const url = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(url);
      const text = (data.text ?? "").trim();
      onProgress?.({ stage: "done", page: 1, pageCount: 1, percent: 100 });
      return { text, pageCount: 1, ocrPageCount: 1, usedOcr: true, isRtl: isRtlText(text) };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    await worker.terminate();
  }
}

/** Extract text from a PDF (with OCR fallback for scanned pages). */
async function extractPdf(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  const pdfjs = await loadPdfjs();
  onProgress?.({ stage: "loading", page: 0, pageCount: 0, percent: 2 });

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount = pdf.numPages;

  const pageTexts: string[] = [];
  const scannedPages: number[] = [];

  // Pass 1 — pull the text layer from every page (logical order preserved).
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) {
        text += item.str;
        if (item.hasEOL) text += "\n";
        else text += " ";
      }
    }
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    pageTexts.push(text);
    if (meaningfulLength(text) < MIN_TEXT_CHARS) scannedPages.push(i);
    onProgress?.({
      stage: "parsing",
      page: i,
      pageCount,
      percent: 2 + Math.round((i / pageCount) * (scannedPages.length ? 40 : 96)),
    });
  }

  // Pass 2 — OCR the pages that had no usable text layer.
  if (scannedPages.length > 0) {
    const worker = await createOcrWorker();
    try {
      for (let idx = 0; idx < scannedPages.length; idx++) {
        const pageNum = scannedPages[idx];
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const ocrText = (await ocrCanvas(worker, canvas)).trim();
        if (ocrText) pageTexts[pageNum - 1] = ocrText;
        onProgress?.({
          stage: "ocr",
          page: pageNum,
          pageCount,
          percent: 42 + Math.round(((idx + 1) / scannedPages.length) * 56),
        });
      }
    } finally {
      await worker.terminate();
    }
  }

  const text = pageTexts.join("\n\n").trim();
  onProgress?.({ stage: "done", page: pageCount, pageCount, percent: 100 });
  return {
    text,
    pageCount,
    ocrPageCount: scannedPages.length,
    usedOcr: scannedPages.length > 0,
    isRtl: isRtlText(text),
  };
}

/** Entry point: extract text from a PDF or image file. */
export async function extractDocument(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  if (typeof window === "undefined") {
    return { text: "", pageCount: 0, ocrPageCount: 0, usedOcr: false, isRtl: false };
  }
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) return extractPdf(file, onProgress);
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name);
  if (isImage) return extractImage(file, onProgress);
  // Fallback: try to read as UTF-8 text.
  const text = (await file.text()).trim();
  return { text, pageCount: 1, ocrPageCount: 0, usedOcr: false, isRtl: isRtlText(text) };
}

export { ARABIC_RE, isRtlText };
