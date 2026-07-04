import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { listTransactions } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/financials")({
  component: FinancialsPage,
});

type Txn = {
  id: string;
  invoice_id: string;
  user_email: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

function FinancialsPage() {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const listFn = useServerFn(listTransactions);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: () => listFn(),
  });

  const rows = (data as Txn[] | undefined) ?? [];
  const total = rows
    .filter((t) => t.status === "succeeded")
    .reduce((s, t) => s + Number(t.amount), 0);

  const statusLabel = (s: string) =>
    s === "succeeded" ? tt("status_succeeded") : s === "refunded" ? tt("status_refunded") : tt("status_failed");
  const statusClass = (s: string) =>
    s === "succeeded"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : s === "refunded"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-destructive/10 text-destructive";

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{tt("financials_title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("financials_subtitle")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-3 shadow-soft">
          <p className="text-xs text-muted-foreground">{tt("total_collected")}</p>
          <p className="text-xl font-bold text-foreground">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{tt("col_invoice")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_amount")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_date")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {tt("no_results")}
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{t.invoice_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.user_email}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ${Number(t.amount).toFixed(2)} {t.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}