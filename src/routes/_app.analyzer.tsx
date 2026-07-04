import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FileDropzone, LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/analyzer")({
  component: AnalyzerTool,
});

function AnalyzerTool() {
  const { t, lang } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ready, setReady] = useState(false);

  const onFile = (f: File) => {
    setFile(f.name);
    setReady(false);
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setReady(true);
    }, 1300);
  };

  const metrics = [
    { label: t("analyzer_revenue"), value: "$1.24M" },
    { label: t("analyzer_expenses"), value: "$820K" },
    { label: t("analyzer_profit"), value: "$420K" },
    { label: t("analyzer_debt"), value: "$310K" },
  ];

  const chartData = [
    { name: "Q1", value: 120 },
    { name: "Q2", value: 138 },
    { name: "Q3", value: 155 },
    { name: "Q4", value: 189 },
  ];

  const flags =
    lang === "ar"
      ? [
          { level: "high", text: "بند غرامة تأخير بنسبة 15% غير معلن بوضوح (المادة 8.2)." },
          { level: "medium", text: "شرط تجديد تلقائي دون إشعار مسبق (المادة 4.1)." },
        ]
      : [
          { level: "high", text: "Undisclosed 15% late-payment penalty clause (Section 8.2)." },
          { level: "medium", text: "Automatic renewal without prior notice (Section 4.1)." },
        ];

  return (
    <div className="mx-auto max-w-5xl">
      <ToolHeader title={t("tool_analyzer")} desc={t("tool_analyzer_desc")} />

      <FileDropzone tool="analyzer" onFile={onFile} fileName={file} />

      {scanning && (
        <div className="mt-6">
          <LoadingRow label={t("analyzer_scan")} />
        </div>
      )}

      {ready && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold text-foreground">{t("analyzer_chart_title")}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("analyzer_flags")}
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{t("analyzer_flags_hint")}</p>
            <ul className="space-y-2.5">
              {flags.map((flag, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      flag.level === "high"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {flag.level === "high" ? t("analyzer_high") : t("analyzer_medium")}
                  </span>
                  <span className="text-sm text-foreground">{flag.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}