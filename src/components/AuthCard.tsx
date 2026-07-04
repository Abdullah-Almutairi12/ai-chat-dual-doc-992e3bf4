import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

function safeRedirect(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const dest = safeRedirect(search?.redirect);
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(lang === "ar" ? "تم تسجيل الدخول" : "Signed in");
        navigate({ to: dest });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success(lang === "ar" ? "تم إنشاء الحساب" : "Account created");
          navigate({ to: dest });
        } else {
          toast.success(
            lang === "ar"
              ? "تحقق من بريدك الإلكتروني لتأكيد الحساب"
              : "Check your email to confirm your account",
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success(lang === "ar" ? "تم تسجيل الدخول" : "Signed in");
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{ background: "var(--gradient-subtle)" }}
      />
      <div className="w-full max-w-sm animate-fade-up rounded-3xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="mb-6 flex justify-center">
          <Logo size={38} />
        </Link>

        <h1 className="text-center text-2xl font-bold text-foreground">
          {t(isLogin ? "login_title" : "signup_title")}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {t(isLogin ? "login_subtitle" : "signup_subtitle")}
        </p>

        <button
          onClick={onGoogle}
          disabled={googleLoading}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {lang === "ar" ? "المتابعة مع Google" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {lang === "ar" ? "أو" : "or"}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!isLogin && (
            <Field
              label={t("name")}
              type="text"
              value={name}
              onChange={setName}
              placeholder="Jane Doe"
              required
            />
          )}
          <Field
            label={t("email")}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
          />
          <Field
            label={t("password")}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
          />
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(isLogin ? "login_action" : "signup_action")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t(isLogin ? "no_account" : "have_account")}{" "}
          <Link
            to={isLogin ? "/signup" : "/login"}
            className="font-medium text-primary hover:underline"
          >
            {t(isLogin ? "signup_action" : "login_action")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}