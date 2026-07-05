import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { PDF_TOOL_CATEGORIES, pdfTools, toolsByCategory } from "@/lib/pdf-tools";

export function PdfToolsHub() {
  const { t, dir } = useI18n();
  const arrow = dir === "rtl" ? "rotate-180" : "";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-elegant sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-subtle)" }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("pdf_suite_badge")}
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("pdf_suite_title")}
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">{t("pdf_suite_subtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-12">
        {PDF_TOOL_CATEGORIES.map((cat) => {
          const items = toolsByCategory(cat.id);
          if (!items.length) return null;
          return (
            <section key={cat.id}>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">{t(cat.titleKey)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t(cat.descKey)}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((tool, i) => (
                  <Link
                    key={tool.id}
                    to="/tools/$toolId"
                    params={{ toolId: tool.id }}
                    className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elegant animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:gradient-hero group-hover:text-primary-foreground">
                      <tool.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{t(tool.titleKey)}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{t(tool.descKey)}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      {t("open_tool")}
                      <ArrowRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${arrow}`} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">{t("pdf_suite_note")}</p>
    </div>
  );
}

/** Compact grid for landing / dashboard */
export function PdfToolsPreviewGrid({ limit = 8 }: { limit?: number }) {
  const { t, dir } = useI18n();
  const arrow = dir === "rtl" ? "rotate-180" : "";
  const preview = pdfTools.slice(0, limit);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {preview.map((tool) => (
        <Link
          key={tool.id}
          to="/tools/$toolId"
          params={{ toolId: tool.id }}
          className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary group-hover:gradient-hero group-hover:text-primary-foreground">
            <tool.icon className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-sm font-semibold">{t(tool.titleKey)}</h3>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
            {t("open_tool")}
            <ArrowRight className={`h-3 w-3 ${arrow}`} />
          </span>
        </Link>
      ))}
    </div>
  );
}
