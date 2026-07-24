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
 *
 * Second landmine: pdf.js's fake-worker `LoopbackPort` still simulates real postMessage
 * semantics by calling `structuredClone(obj, { transfer })` for every message, even though
 * main-thread and "worker" run in the same process. Node's *native* `structuredClone` only
 * accepts genuine `ArrayBuffer`/`MessagePort`/`FileHandle` values in its transfer list — when
 * pdf.js hands it something else to "transfer" (e.g. decoded image bitmaps while rendering a
 * page with embedded images), Node throws `DataCloneError: Cannot transfer object of
 * unsupported type` and the whole request 500s. Upstream pdf.js's own fix for this exact
 * Node/legacy-build problem (mozilla/pdf.js#16279) is to simply skip the transfer list — since
 * nothing is really crossing a thread boundary here, a plain (non-transferring) clone is just
 * as correct and always succeeds. We can't patch the bundled LoopbackPort directly, so we wrap
 * the global `structuredClone` to fall back to a transfer-less clone whenever the transfer
 * list itself is what's rejected.
 */
import * as PdfWorkerModule from "@/lib/pdf/vision/pdf-thread-handler.vendor.mjs";

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
  // eslint-disable-next-line no-var
  var __pdfjsSafeCloneInstalled: boolean | undefined;
}

function installSafeStructuredClone(): void {
  if (globalThis.__pdfjsSafeCloneInstalled) return;
  const native = globalThis.structuredClone?.bind(globalThis);
  if (!native) return;
  globalThis.__pdfjsSafeCloneInstalled = true;
  globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
    if (options?.transfer?.length) {
      try {
        return native(value, options);
      } catch (err) {
        if (err instanceof Error && err.name === "DataCloneError") {
          return native(value);
        }
        throw err;
      }
    }
    return native(value, options);
  }) as typeof structuredClone;
}

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Load pdfjs-dist (legacy Node build) with a correctly-wired worker for serverless environments. */
export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      installSafeStructuredClone();
      globalThis.pdfjsWorker ??= PdfWorkerModule as unknown as { WorkerMessageHandler: unknown };
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc ||= "pdfjs-worker-inline";
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}
