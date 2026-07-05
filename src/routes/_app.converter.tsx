import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, FileType2, LayoutTemplate, ScanText } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone, LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";
import { useActiveDocument } from "@/lib/active-document";
import { extractLayout, layoutToHtml, type LayoutProgress } from "@/lib/pdf-layout";

export const Route = createFileRoute("/_app/converter")({
  head: () =>
    pageHead({
      path: "/converter",
      title: "PDF Converter & OCR — PDF to Word | PDF Quanta",
      description:
        "Convert PDFs to editable Word documents, run Arabic OCR, and rebuild scanned PDFs with their exact layout, tables and design preserved.",
    }),
  component: ConverterTool,
});

type Mode = "word" | "ocr" | "layout";

function ConverterTool() {
  const { t } = useI18n();
  const { doc, clear } = useActiveDocument();
  const fileName = doc?.name ?? null;
  const rawFileRef = useRef<File | null>(null);
  const [mode, setMode] = useState<Mode>("word");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const [layoutHtml, setLayoutHtml] = useState<string | null>(null);
  const [layoutProgress, setLayoutProgress] = useState<LayoutProgress | null>(null);

  const preview = doc?.text?.trim() || t("extract_empty");

  const runText = () => {
    setProcessing(true);
    setDone(false);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
      toast.success(t("convert_done"));
    }, 500);
  };

  const runLayout = async () => {
    const file = rawFileRef.current;
    if (!file) {
      toast.error(t("extract_failed"));
      return;
    }
    setLayoutHtml(null);
    setDone(false);
    setLayoutProgress({ stage: "loading", page: 0, pageCount: 0, percent: 0 });
    try {
      const result = await extractLayout(file, setLayoutProgress);
      const html = layoutToHtml(result, file.name.replace(/\.\w+$/i, ""));
      setLayoutHtml(html);
      setDone(true);
      toast.success(t("convert_done"));
    } catch (err) {
      console.error("[converter] layout build failed", err);
      toast.error(t("extract_failed"));
    } finally {
      setLayoutProgress(null);
    }
  };

  const run = () => {
    if (!fileName) return;
    if (mode === "layout") void runLayout();
    else runText();
  };

  const download = () => {
    const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName ?? "document").replace(/\.\w+$/i, "")}.${mode === "word" ? "doc" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHtml = () => {
    if (!layoutHtml) return;
    const blob = new Blob([layoutHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName ?? "document").replace(/\.\w+$/i, "")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const options: { id: Mode; label: string; icon: typeof FileType2 }[] = [
    { id: "word", label: t("convert_word"), icon: FileType2 },
    { id: "ocr", label: t("convert_ocr"), icon: ScanText },
    { id: "layout", label: t("convert_layout"), icon: LayoutTemplate },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <ToolHeader title={t("tool_converter")} desc={t("tool_converter_desc")} />

      <FileDropzone
        tool="converter"
        onFile={(f) => {
          rawFileRef.current = f;
          setDone(false);
          setLayoutHtml(null);
        }}
        accept="application/pdf,.pdf,image/*"
        fileName={fileName}
      />
      {doc && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {doc.pageCount} {t("pages_label")}
          </span>
          <span>{doc.usedOcr ? t("ocr_badge") : t("text_layer_badge")}</span>
          <button
            onClick={() => {
              clear();
              rawFileRef.current = null;
              setLayoutHtml(null);
              setDone(false);
            }}
            className="font-medium text-primary hover:underline"
          >
            {t("dropzone_replace")}
          </button>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-foreground">{t("convert_target")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setMode(opt.id);
                setDone(false);
              }}
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
        {mode === "layout" && <p className="mt-2 text-sm text-muted-foreground">{t("convert_layout_note")}</p>}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={run} disabled={!fileName || processing || !!layoutProgress} className="gap-2 shadow-soft">
          {t("convert_run")}
        </Button>
      </div>

      {processing && (
        <div className="mt-6">
          <LoadingRow label={t("convert_processing")} />
        </div>
      )}

      {layoutProgress && (
        <div className="mt-6">
          <LoadingRow
            label={`${t("convert_layout_building")} ${
              layoutProgress.pageCount ? `${layoutProgress.page}/${layoutProgress.pageCount}` : ""
            } · ${layoutProgress.percent}%`}
          />
        </div>
      )}

      {done && mode === "layout" && layoutHtml && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t("convert_result_title")}</h3>
            <Button onClick={downloadHtml} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              {t("convert_download_html")}
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t("convert_layout_hint")}</p>
          <iframe
            title={t("convert_result_title")}
            srcDoc={layoutHtml}
            className="h-[70vh] w-full rounded-xl border border-border bg-muted"
          />
        </div>
      )}

      {done && mode !== "layout" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("convert_result_title")}</h3>
          <p
            dir="auto"
            className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-accent/40 p-4 text-sm leading-relaxed text-foreground"
          >
            {preview}
          </p>
          <Button onClick={download} variant="outline" className="mt-4 gap-2">
            <Download className="h-4 w-4" />
            {t("convert_download")}
          </Button>
        </div>
      )}
    </div>
  );
}
