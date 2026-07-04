import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Languages, Menu } from "lucide-react";
import { useState } from "react";

import { AppSidebarContent } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { t, toggleLang, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const side = dir === "rtl" ? "right" : "left";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-e border-sidebar-border lg:block">
        <div className="sticky top-0 h-screen">
          <AppSidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={side} className="w-72 p-0">
                <SheetTitle className="sr-only">{t("brand")}</SheetTitle>
                <AppSidebarContent onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium text-muted-foreground">{t("tagline")}</span>
          </div>

          <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
            <Languages className="h-4 w-4" />
            <span>{t("lang_toggle")}</span>
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}