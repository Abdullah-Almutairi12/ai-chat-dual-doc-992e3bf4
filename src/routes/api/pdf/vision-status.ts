import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/lib/api-auth.server";
import { getVisionEnvDiagnostics } from "@/lib/pdf/vision/config.server";
import { MAX_VISION_PAGES } from "@/lib/pdf/vision/schema";

/**
 * GET /api/pdf/vision-status
 * Public health check — confirms cloud Vision AI keys are wired on this deployment.
 */
export const Route = createFileRoute("/api/pdf/vision-status")({
  server: {
    handlers: {
      GET: async () => {
        const diagnostics = getVisionEnvDiagnostics();
        return jsonResponse({
          ok: diagnostics.ok,
          vision: diagnostics,
          maxPages: MAX_VISION_PAGES,
          message: diagnostics.ok
            ? "Cloud Vision AI is active for file conversion."
            : "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI-powered conversion.",
        });
      },
    },
  },
});
