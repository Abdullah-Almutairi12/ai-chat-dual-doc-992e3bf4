import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

function safeRedirect(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { next, code } = Route.useSearch();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const dest = safeRedirect(next);

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("No session returned from OAuth provider");
        }

        if (cancelled) return;
        toast.success(lang === "ar" ? "تم تسجيل الدخول" : "Signed in");
        await navigate({ to: dest, replace: true });
      } catch (err) {
        if (cancelled) return;
        console.error("[auth/callback]", err);
        toast.error(err instanceof Error ? err.message : "Authentication failed");
        await navigate({ to: "/login", search: { redirect: dest }, replace: true });
      }
    }

    void completeAuth();
    return () => {
      cancelled = true;
    };
  }, [code, dest, lang, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "جارٍ إكمال تسجيل الدخول…" : "Completing sign-in…"}
        </p>
      </div>
    </div>
  );
}
