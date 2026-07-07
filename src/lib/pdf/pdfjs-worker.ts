/** Configure pdf.js worker for Vite/Vercel production builds. */
export async function configurePdfjsWorker(pdfjs: typeof import("pdfjs-dist")): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const workerUrl = workerModule.default;
    if (workerUrl) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return;
    }
  } catch (err) {
    console.warn("[pdfjs] bundled worker unavailable, using CDN fallback", err);
  }

  try {
    const pkg = await import("pdfjs-dist/package.json");
    const version = (pkg as { default?: { version?: string }; version?: string }).default?.version
      ?? (pkg as { version?: string }).version
      ?? "4.10.38";
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  }
}

export async function loadPdfjsWithWorker() {
  const pdfjs = await import("pdfjs-dist");
  await configurePdfjsWorker(pdfjs);
  return pdfjs;
}
