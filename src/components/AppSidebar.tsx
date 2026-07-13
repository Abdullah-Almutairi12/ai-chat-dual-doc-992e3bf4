import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import { useQueryClient } from "@tanstack/react-query";

import {

  LayoutDashboard,

  LogIn,

  LogOut,

  Shield,

  Sparkles,

  Wrench,

} from "lucide-react";



import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import { Logo } from "@/components/Logo";

import { useAuth } from "@/hooks/use-auth";

import { useI18n } from "@/lib/i18n";

import { tools } from "@/lib/tools";

import { supabase } from "@/integrations/supabase/client";



export function AppSidebarContent({ onNavigate }: { onNavigate?: () => void }) {

  const { t } = useI18n();

  const { user, isReady, isAuthenticated } = useAuth();

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const pathname = useRouterState({ select: (s) => s.location.pathname });



  const handleSignOut = async () => {

    onNavigate?.();

    await queryClient.cancelQueries();

    queryClient.clear();

    await supabase.auth.signOut();

    navigate({ to: "/", replace: true });

  };



  const email = user?.email ?? "";

  const initial = email ? email[0]!.toUpperCase() : "U";



  const linkClass = (active: boolean) =>

    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${

      active

        ? "bg-sidebar-accent text-sidebar-accent-foreground"

        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"

    }`;



  return (

    <div className="flex h-full flex-col bg-sidebar">

      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">

        <Link to="/" onClick={onNavigate} className="min-w-0">

          <Logo size={32} />

        </Link>

      </div>



      <nav className="flex-1 overflow-y-auto p-3">

        <Link to="/dashboard" onClick={onNavigate} className={linkClass(pathname === "/dashboard")}>

          <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />

          <span className="truncate">{t("dashboard_title")}</span>

        </Link>



        <Link to="/tools" onClick={onNavigate} className={linkClass(pathname.startsWith("/tools"))}>

          <Wrench className="h-[18px] w-[18px] shrink-0" />

          <span className="truncate">{t("pdf_suite_title")}</span>

        </Link>



        <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">

          {t("sidebar_tools")}

        </p>

        {tools.map((tool) => (

          <Link

            key={tool.id}

            to={tool.path}

            onClick={onNavigate}

            className={linkClass(pathname === tool.path)}

          >

            <tool.icon className="h-[18px] w-[18px] shrink-0" />

            <span className="truncate">{t(tool.titleKey)}</span>

          </Link>

        ))}

      </nav>



      <div className="border-t border-sidebar-border p-3">

        <Button asChild variant="ghost" size="sm" className="mb-1 w-full justify-start gap-2 text-sidebar-foreground/70">

          <Link to="/pricing" onClick={onNavigate}>

            <Sparkles className="h-4 w-4 text-primary" />

            {t("nav_pricing")}

          </Link>

        </Button>

        <Button asChild variant="ghost" size="sm" className="mb-1 w-full justify-start gap-2 text-sidebar-foreground/70">

          <Link to="/admin" onClick={onNavigate}>

            <Shield className="h-4 w-4" />

            {t("nav_admin")}

          </Link>

        </Button>



        {isReady && isAuthenticated ? (

          <div className="mt-2 space-y-2 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2">

            <div className="flex items-center gap-2 px-1">

              <Avatar className="h-8 w-8 shrink-0">

                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">

                  {initial}

                </AvatarFallback>

              </Avatar>

              <div className="min-w-0 flex-1">

                <p className="truncate text-xs font-medium text-sidebar-foreground">{t("nav_account")}</p>

                <p className="truncate text-xs text-sidebar-foreground/60">{email}</p>

              </div>

            </div>

            <Button

              type="button"

              variant="outline"

              size="sm"

              className="w-full gap-2"

              onClick={() => void handleSignOut()}

            >

              <LogOut className="h-4 w-4" />

              {t("nav_logout")}

            </Button>

          </div>

        ) : isReady ? (

          <Button asChild variant="outline" size="sm" className="w-full gap-2">

            <Link to="/login" onClick={onNavigate}>

              <LogIn className="h-4 w-4" />

              {t("nav_login")}

            </Link>

          </Button>

        ) : (

          <div className="h-9" aria-hidden="true" />

        )}

      </div>

    </div>

  );

}

