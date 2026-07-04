import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileType2, ScanText } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone, LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/converter")({
  component: ConverterTool,
});

type Mode = "word" | "ocr";

function ConverterTool() {
  const { t, lang } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("word");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const run = () => {
    if (!file) return;
    setProcessing(true);
    setDone(false);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
      toast.success(t("convert_done"));
    }, 1400);
  };

  const preview =
    lang === "ar"
      ? "هذا نص قابل للتحرير تم استخراجه من المستند مع الحفاظ على دقة الحروف العربية والتشكيل والفقرات."
      : "This is editable text extracted from your document, preserving paragraphs, layout, and character accuracy.";

  const download = () => {
    const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file ?? "document").replace(/\.\w+$/i, "")}.${mode === "word" ? "doc" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const options: { id: Mode; label: string; icon: typeof FileType2 }[] = [
    { id: "word", label: t("convert_word"), icon: FileType2 },
    { id: "ocr", label: t("convert_ocr"), icon: ScanText },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <ToolHeader title={t("tool_converter")} desc={t("tool_converter_desc")} />

      <FileDropzone
        tool="converter"
        onFile={(f) => {
          setFile(f.name);
          setDone(false);
        }}
        accept="application/pdf,.pdf,image/*"
        fileName={file}
      />

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-foreground">{t("convert_target")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition-all ${
                mode === opt.id
                  ? "border-primary bg-accent shadow-soft"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  mode === opt.id ? "gradient-hero text-primary-foreground" : "bg-accent text-primary"
                }`}
              >
                <opt.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
        {mode === "ocr" && <p className="mt-2 text-sm text-muted-foreground">{t("convert_ocr_note")}</p>}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={run} disabled={!file || processing} className="gap-2 shadow-soft">
          {t("convert_run")}
        </Button>
      </div>

      {processing && (
        <div className="mt-6">
          <LoadingRow label={t("convert_processing")} />
        </div>
      )}

      {done && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("convert_result_title")}</h3>
          <p className="rounded-xl bg-accent/40 p-4 text-sm leading-relaxed text-foreground">{preview}</p>
          <Button onClick={download} variant="outline" className="mt-4 gap-2">
            <Download className="h-4 w-4" />
            {t("convert_download")}
          </Button>
        </div>
      )}
    </div>
  );
}