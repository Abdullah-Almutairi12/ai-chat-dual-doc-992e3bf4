import { Link } from "@tanstack/react-router";
import { FileText, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function Navbar() {
  const { t, toggleLang } = useI18n();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-hero text-primary-foreground shadow-soft">
            <FileText className="h-5 w-5" />
          </span>
          <span className="truncate text-lg tracking-tight">{t("brand")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <a href="#features" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav_features")}
          </a>
          <Link
            to="/dashboard"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav_dashboard")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
            <Languages className="h-4 w-4" />
            <span>{t("lang_toggle")}</span>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">{t("nav_login")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">{t("nav_signup")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
