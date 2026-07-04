import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: () => <AuthCard mode="login" />,
});