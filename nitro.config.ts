import { defineConfig } from "nitro/config";

/** Force Vercel Node serverless — overrides Lovable/Cloudflare default preset. */
export default defineConfig({
  preset: "vercel",
  compatibilityDate: "2024-11-01",
  routeRules: {
    "/api/pdf/convert-vision": { maxDuration: 60 },
    "/api/pdf/convert-chunk": { maxDuration: 60 },
    "/api/pdf/convert-build": { maxDuration: 60 },
  },
});
