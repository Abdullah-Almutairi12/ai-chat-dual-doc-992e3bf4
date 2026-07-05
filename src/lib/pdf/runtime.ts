/** Guards and helpers for browser-only PDF processing. */

export const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

export function requireBrowser(message = "PDF processing requires a browser environment"): void {
  if (!isBrowser) throw new Error(message);
}

/** Lazy-load pdf-lib only in the browser (never during SSR bundle evaluation). */
export async function loadPdfLibModule() {
  requireBrowser();
  return import("pdf-lib");
}

/** Lazy-load xlsx only in the browser. */
export async function loadXlsxModule() {
  requireBrowser();
  return import("xlsx");
}

/** Lazy-load docx only in the browser. */
export async function loadDocxModule() {
  requireBrowser();
  return import("docx");
}

/** Lazy-load jspdf only in the browser. */
export async function loadJsPdfModule() {
  requireBrowser();
  return import("jspdf");
}

type JsPdfConstructor = typeof import("jspdf").jsPDF;

/** Resolve jsPDF constructor across ESM/CJS export shapes (v3+). */
export async function resolveJsPdfConstructor(): Promise<JsPdfConstructor> {
  const mod = await loadJsPdfModule();
  const modAny = mod as {
    jsPDF?: JsPdfConstructor;
    default?: JsPdfConstructor | { jsPDF?: JsPdfConstructor };
  };
  const ctor =
    modAny.jsPDF ??
    (typeof modAny.default === "function" ? modAny.default : modAny.default?.jsPDF);
  if (!ctor) throw new Error("jsPDF module export not found");
  return ctor;
}

/** Lazy-load pptxgenjs only in the browser. */
export async function loadPptxModule() {
  requireBrowser();
  return import("pptxgenjs");
}
