import { createFileRoute } from "@tanstack/react-router";

import { authenticateRequest, jsonResponse, unauthorizedResponse, ApiConfigError, configErrorResponse } from "@/lib/api-auth.server";

/** File storage disabled — all processing is in-memory. */
export const Route = createFileRoute("/api/pdf/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateRequest(request);
          return jsonResponse(
            { ok: false, error: "File storage is disabled. Process files in-memory only.", code: "STORAGE_DISABLED" },
            410,
          );
        } catch (err) {
          if (err instanceof ApiConfigError) return configErrorResponse(err);
          if (err instanceof Error && err.message === "Unauthorized") return unauthorizedResponse();
          return jsonResponse({ ok: false, error: "Upload disabled" }, 410);
        }
      },
    },
  },
});
