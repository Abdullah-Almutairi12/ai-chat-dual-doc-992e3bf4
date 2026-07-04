import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { tools } from "@/lib/tools";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t, dir } = useI18n();
  const arrow = dir === "rtl" ? "rotate-180" : "";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("dashboard_title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("dashboard_welcome")}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, i) => (
          <Link
            key={tool.id}
            to={tool.path}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant animate-fade-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:gradient-hero group-hover:text-primary-foreground">
              <tool.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t(tool.titleKey)}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t(tool.descKey)}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {t("open_tool")}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${arrow}`} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}