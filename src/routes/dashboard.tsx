import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, History, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  addDocument,
  deleteDocument,
  getDocuments,
  type PdfDocument,
} from "@/lib/documents";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [docs, setDocs] = useState<PdfDocument[]>([]);

  useEffect(() => {
    const refresh = () => setDocs(getDocuments());
    refresh();
    window.addEventListener("pdf-docs-changed", refresh);
    return () => window.removeEventListener("pdf-docs-changed", refresh);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error(lang === "ar" ? "الرجاء رفع ملف PDF فقط" : "Please upload a PDF file");
      return;
    }
    const doc = addDocument(file.name, Math.round(file.size / 1024));
    toast.success(lang === "ar" ? "تم رفع المستند" : "Document uploaded");
    navigate({ to: "/chat/$docId", params: { docId: doc.id } });
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("dashboard_title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dashboard_subtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
              dragging
                ? "border-primary bg-accent shadow-elegant scale-[1.01]"
                : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
            }`}
          >
            <span
              className={`grid h-20 w-20 place-items-center rounded-2xl gradient-hero text-primary-foreground shadow-soft transition-transform duration-300 ${
                dragging ? "scale-110" : ""
              }`}
            >
              <UploadCloud className="h-9 w-9" />
            </span>
            <p className="mt-6 max-w-sm text-lg font-medium text-foreground">{t("dropzone_text")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("dropzone_hint")}</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <aside className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("history_title")}
              </h2>
            </div>

            {docs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("history_empty")}</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <div className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-accent/40">
                      <button
                        onClick={() => navigate({ to: "/chat/$docId", params: { docId: doc.id } })}
                        className="flex min-w-0 flex-1 items-center gap-3 text-start"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {doc.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(doc.uploadedAt)} · {doc.sizeKb} KB
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}