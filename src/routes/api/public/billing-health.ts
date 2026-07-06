import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/billing-health
 * Server-only: dynamic-imports env.server so secrets never enter the client bundle.
 */
export const Route = createFileRoute("/api/public/billing-health")({
  server: {
    handlers: {
      GET: async () => {
        const { hydrateVercelProductionEnv, getBillingEnvDiagnostics, billingEnvError } =
          await import("@/integrations/supabase/env.server");

        hydrateVercelProductionEnv();

        const diagnostics = getBillingEnvDiagnostics();
        const ok = diagnostics.missing.length === 0;

        return new Response(
          JSON.stringify({
            ok,
            ...diagnostics,
            message: ok ? null : billingEnvError(diagnostics.missing),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
