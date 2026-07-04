import { Link } from "@tanstack/react-router";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";

export function Navbar() {
  const { t, toggleLang } = useI18n();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="min-w-0">
          <Logo size={34} />
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
