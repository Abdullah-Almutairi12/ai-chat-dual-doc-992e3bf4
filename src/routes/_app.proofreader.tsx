import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/proofreader")({
  head: () =>
    pageHead({
      path: "/proofreader",
      title: "AI PDF Proofreader — Grammar & Style Check | PDF Quanta",
      description:
        "Fix spelling, grammar, and style in your PDFs and documents. PDF Quanta's bilingual AI proofreader rewrites text clearly in English and Arabic.",
    }),
  component: ProofreaderTool,
});

type Issue = { type: "spelling" | "grammar" | "style"; wrong: string; suggestion: string };

const sample = {
  en: {
    text: "The company recieve many request from there customers, and it dont respond quick enough to they're needs.",
    rewrite:
      "The company receives many requests from its customers, and it does not respond quickly enough to their needs.",
    issues: [
      { type: "spelling", wrong: "recieve", suggestion: "receives" },
      { type: "grammar", wrong: "there customers", suggestion: "its customers" },
      { type: "grammar", wrong: "dont", suggestion: "does not" },
      { type: "style", wrong: "quick", suggestion: "quickly" },
    ] as Issue[],
  },
  ar: {
    text: "الشركة تستقبل العديد من الطلبات من عملائها، ولاكن لا تستجيب بسرعه كافيه لأحتياجاتهم.",
    rewrite: "تستقبل الشركة العديد من الطلبات من عملائها، ولكنها لا تستجيب بالسرعة الكافية لاحتياجاتهم.",
    issues: [
      { type: "spelling", wrong: "ولاكن", suggestion: "ولكن" },
      { type: "spelling", wrong: "بسرعه", suggestion: "بسرعة" },
      { type: "spelling", wrong: "كافيه", suggestion: "كافية" },
      { type: "grammar", wrong: "لأحتياجاتهم", suggestion: "لاحتياجاتهم" },
    ] as Issue[],
  },
};

function ProofreaderTool() {
  const { t, lang } = useI18n();
  const data = sample[lang];
  const [text, setText] = useState(data.text);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<typeof data | null>(null);

  const scan = () => {
    setScanning(true);
    setResult(null);
    setTimeout(() => {
      setResult(data);
      setScanning(false);
    }, 1100);
  };

  const badge = (type: Issue["type"]) => {
    const map = {
      spelling: "bg-destructive/10 text-destructive",
      grammar: "bg-primary/10 text-primary",
      style: "bg-accent-foreground/10 text-accent-foreground",
    };
    const label = {
      spelling: t("proof_error_spelling"),
      grammar: t("proof_error_grammar"),
      style: t("proof_error_style"),
    };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[type]}`}>{label[type]}</span>;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ToolHeader title={t("tool_proofreader")} desc={t("tool_proofreader_desc")} />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={scan} disabled={scanning} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t("proof_scan")}
          </Button>
        </div>
      </div>

      {scanning && (
        <div className="mt-6">
          <LoadingRow label={t("proof_scan")} />
        </div>
      )}

      {result && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t("proof_issues")} ({result.issues.length})
            </h3>
            <ul className="space-y-2.5">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3">
                  {badge(issue.type)}
                  <span className="text-sm text-destructive line-through">{issue.wrong}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm font-medium text-foreground">{issue.suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wand2 className="h-4 w-4 text-primary" />
              {t("proof_rewrite")}
            </div>
            <p className="rounded-xl bg-accent/40 p-4 text-sm leading-relaxed text-foreground">{result.rewrite}</p>
            <Button
              onClick={() => {
                setText(result.rewrite);
                toast.success(t("proof_applied"));
              }}
              variant="outline"
              className="mt-4 w-full gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("proof_apply")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}