/**
 * Shared pdfjs-dist (Node/legacy build) loader for server-side PDF rendering & text extraction.
 *
 * pdfjs-dist always needs a worker (real or "fake"/same-thread). In Node it always uses the fake
 * worker, which normally does `await import(GlobalWorkerOptions.workerSrc)` to fetch
 * `WorkerMessageHandler`. On Vercel's Node serverless bundler that dynamic import breaks —
 * `pdf.worker.mjs` never lands next to the bundled `pdf.mjs` (bundle tracing/hoisting renames or
 * drops it), so every PDF operation crashed with:
 *   "Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'"
 *
 * Fix: pdf.js has a documented escape hatch for exactly this — if `globalThis.pdfjsWorker` already
 * has a `WorkerMessageHandler`, it's used directly and the dynamic import is skipped entirely
 * (see PDFWorker#mainThreadWorkerMessageHandler in pdf.mjs). We vendor the worker build into our
 * own source tree (so the bundler ships it as plain, ordinary code rather than special-casing a
 * "*.worker.mjs" file from node_modules into a browser asset) and assign it to `globalThis`
 * before ever calling `getDocument`.
 */
import * as PdfWorkerModule from "@/lib/pdf/vision/pdf-thread-handler.vendor.mjs";

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Load pdfjs-dist (legacy Node build) with a correctly-wired worker for serverless environments. */
export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      globalThis.pdfjsWorker ??= PdfWorkerModule as unknown as { WorkerMessageHandler: unknown };
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc ||= "pdfjs-worker-inline";
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}
