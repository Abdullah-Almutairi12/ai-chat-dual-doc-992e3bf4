import { Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{ background: "var(--gradient-subtle)" }}
      />
      <div className="w-full max-w-sm animate-fade-up rounded-3xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-xl gradient-hero text-primary-foreground shadow-soft">
            <FileText className="h-5 w-5" />
          </span>
          <span className="text-lg">{t("brand")}</span>
        </Link>

        <h1 className="text-center text-2xl font-bold text-foreground">
          {t(isLogin ? "login_title" : "signup_title")}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {t(isLogin ? "login_subtitle" : "signup_subtitle")}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.info(lang === "ar" ? "المصادقة قريبًا" : "Authentication coming soon");
            navigate({ to: "/dashboard" });
          }}
          className="mt-6 space-y-4"
        >
          {!isLogin && <Field label={t("name")} type="text" placeholder="Jane Doe" />}
          <Field label={t("email")} type="email" placeholder="you@example.com" />
          <Field label={t("password")} type="password" placeholder="••••••••" />
          <Button type="submit" className="w-full" size="lg">
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

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}