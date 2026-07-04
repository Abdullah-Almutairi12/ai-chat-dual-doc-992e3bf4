import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, LayoutDashboard, LogIn, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { tools } from "@/lib/tools";
import { deleteDocument, getDocuments, type PdfDocument } from "@/lib/documents";

export function AppSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [docs, setDocs] = useState<PdfDocument[]>([]);

  useEffect(() => {
    const refresh = () => setDocs(getDocuments());
    refresh();
    window.addEventListener("documind-docs-changed", refresh);
    return () => window.removeEventListener("documind-docs-changed", refresh);
  }, []);

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

        <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
          {t("history_title")}
        </p>
        {docs.length === 0 ? (
          <p className="px-3 py-2 text-sm text-sidebar-foreground/50">{t("history_empty")}</p>
        ) : (
          <ul className="space-y-0.5">
            {docs.slice(0, 8).map((doc) => (
              <li
                key={doc.id}
                className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{doc.name}</span>
                  <span className="block text-xs text-sidebar-foreground/40">
                    {new Date(doc.uploadedAt).toLocaleDateString(lang === "ar" ? "ar" : "en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="shrink-0 text-sidebar-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button asChild variant="outline" size="sm" className="w-full gap-2">
          <Link to="/login" onClick={onNavigate}>
            <LogIn className="h-4 w-4" />
            {t("nav_login")}
          </Link>
        </Button>
      </div>
    </div>
  );
}