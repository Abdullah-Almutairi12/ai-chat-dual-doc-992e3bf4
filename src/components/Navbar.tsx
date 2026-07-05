import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Languages, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const { t, toggleLang } = useI18n();
  const { user, isReady, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const email = user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "U";

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
          <Link
            to="/pricing"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav_pricing")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLang}
            className="gap-1.5"
            aria-label={`Switch language to ${t("lang_toggle")}`}
            title={t("lang_toggle")}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            <span>{t("lang_toggle")}</span>
          </Button>

          {/* Render nothing auth-related until the session is resolved to avoid a flash */}
          {isReady && isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("nav_account")}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer gap-2">
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    {t("nav_dashboard")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t("nav_logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : isReady ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">{t("nav_login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">{t("nav_signup")}</Link>
              </Button>
            </>
          ) : (
            <div className="h-9 w-9" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
