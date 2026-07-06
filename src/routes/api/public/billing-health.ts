import { createFileRoute } from "@tanstack/react-router";

import { billingEnvError, getBillingEnvDiagnostics } from "@/integrations/supabase/env";

/** Server route — reads live Vercel / platform env at request time. */
export const Route = createFileRoute("/api/public/billing-health")({
  server: {
    handlers: {
      GET: async () => {
        const diagnostics = getBillingEnvDiagnostics();
        const ok = diagnostics.missing.length === 0;
        const message = ok ? null : billingEnvError(diagnostics.missing);
        return new Response(
          JSON.stringify({
            ok,
            ...diagnostics,
            message: message || null,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
