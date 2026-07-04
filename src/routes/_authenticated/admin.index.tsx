import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CreditCard, FileText, Loader2, TrendingUp, Users } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { getOverviewStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { lang, dir } = useI18n();
  const tt = adminT(lang);
  const statsFn = useServerFn(getOverviewStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => statsFn() });

  const cards = [
    {
      label: tt("stat_users"),
      value: data ? data.totalUsers.toLocaleString() : "—",
      sub: data ? `${data.premiumUsers} ${tt("stat_premium")}` : "",
      icon: Users,
    },
    {
      label: tt("stat_documents"),
      value: data ? data.totalDocuments.toLocaleString() : "—",
      icon: FileText,
    },
    {
      label: tt("stat_revenue"),
      value: data ? `$${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
      icon: CreditCard,
    },
    {
      label: tt("stat_credits"),
      value: data ? data.creditsUsed.toLocaleString() : "—",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{tt("overview_title")}</h1>
        <p className="text-sm text-muted-foreground">{tt("overview_subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-soft"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                <c.icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">{c.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            {c.sub && <p className="mt-0.5 text-xs text-primary">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold text-foreground">{tt("trend_title")}</h2>
        {isLoading ? (
          <div className="grid h-72 place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trends ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(245 58% 51%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(245 58% 51%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(266 70% 58%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(266 70% 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "users" ? tt("trend_users") : tt("trend_documents"))} />
                <Area type="monotone" dataKey="users" stroke="hsl(245 58% 51%)" strokeWidth={2} fill="url(#gUsers)" />
                <Area type="monotone" dataKey="documents" stroke="hsl(266 70% 58%)" strokeWidth={2} fill="url(#gDocs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {dir === "rtl" && null}
      </div>
    </div>
  );
}