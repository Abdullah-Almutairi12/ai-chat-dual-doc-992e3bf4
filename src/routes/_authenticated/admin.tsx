import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BarChart3,
  CreditCard,
  FileClock,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  Moon,
  ShieldAlert,
  Sun,
  Settings2,
  Users,
  ArrowLeft,
  Languages,
} from "lucide-react";
import { toast } from "sonner";

import { Logo, LogoIcon } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { adminT } from "@/lib/admin-i18n";
import { getAdminStatus, claimFirstAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", icon: LayoutGrid, key: "nav_overview" as const, exact: true },
  { to: "/admin/users", icon: Users, key: "nav_users" as const },
  { to: "/admin/documents", icon: FileClock, key: "nav_documents" as const },
  { to: "/admin/financials", icon: CreditCard, key: "nav_financials" as const },
  { to: "/admin/settings", icon: Settings2, key: "nav_settings" as const },
];

function AdminLayout() {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const [open, setOpen] = useState(false);
  const { dir } = useI18n();
  const side = dir === "rtl" ? "right" : "left";

  const statusFn = useServerFn(getAdminStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => statusFn(),
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!status?.isAdmin) {
    return <AccessGate adminExists={!!status?.adminExists} />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 border-e border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <AdminSidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onMenu={() => setOpen(true)} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side={side} className="w-64 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">{tt("admin_brand")}</SheetTitle>
            <AdminSidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <LogoIcon size={30} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-sidebar-foreground">PDF Quanta</p>
          <p className="truncate text-xs text-sidebar-foreground/50">{tt("admin_brand")}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{tt(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button asChild variant="outline" size="sm" className="w-full gap-2">
          <Link to="/dashboard" onClick={onNavigate}>
            <ArrowLeft className="h-4 w-4" />
            {tt("exit_app")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AdminHeader({ onMenu }: { onMenu: () => void }) {
  const { lang, toggleLang, t } = useI18n();
  const tt = adminT(lang);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <span className="hidden text-sm font-medium text-muted-foreground sm:block">
        {tt("admin_brand")}
      </span>

      <div className="ms-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{t("lang_toggle")}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{tt("sign_out")}</span>
        </Button>
      </div>
    </header>
  );
}

function AccessGate({ adminExists }: { adminExists: boolean }) {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const claimFn = useServerFn(claimFirstAdmin);
  const [loading, setLoading] = useState(false);

  const claim = async () => {
    setLoading(true);
    try {
      await claimFn();
      toast.success(tt("claim_success"));
      await queryClient.invalidateQueries({ queryKey: ["admin-status"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-elegant">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
          <ShieldAlert className="h-7 w-7" />
        </div>
        {adminExists ? (
          <>
            <h1 className="text-xl font-bold text-foreground">{tt("access_denied")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tt("access_denied_desc")}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground">{tt("claim_admin")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tt("claim_admin_desc")}</p>
            <Button onClick={claim} disabled={loading} className="mt-5 w-full gap-2" size="lg">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tt("claim_admin_btn")}
            </Button>
          </>
        )}
        <Button asChild variant="ghost" className="mt-3 w-full">
          <Link to="/dashboard">{tt("back_home")}</Link>
        </Button>
      </div>
    </div>
  );
}