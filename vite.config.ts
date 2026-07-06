// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Public client vars: VITE_* and APP_* are embedded at build time.
    // SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are also exposed for Vercel naming.
    // Server secrets (SERVICE_ROLE, TAP_SECRET_KEY) must use readServerEnv() — never import.meta.env.
    envPrefix: ["VITE_", "SUPABASE_", "APP_"],
    ssr: {
      // Keep browser-only PDF/Office libraries out of the SSR server bundle.
      external: ["pdfjs-dist", "pdf-lib", "docx", "xlsx", "jspdf", "pptxgenjs", "tesseract.js"],
    },
  },
});
