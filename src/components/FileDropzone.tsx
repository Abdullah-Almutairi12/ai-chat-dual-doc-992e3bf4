import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { addDocument } from "@/lib/documents";
import { extractDocument, type ExtractProgress } from "@/lib/pdf-extract";
import { useActiveDocument, type ActiveDocument } from "@/lib/active-document";
import { useEntitlement } from "@/lib/entitlement";
import { FreeCreditBadge } from "@/components/FreeCreditBadge";

type Props = {
  tool: string;
  onFile: (file: File) => void;
  /** Called with the fully-extracted document (text + OCR metadata). */
  onExtracted?: (doc: ActiveDocument) => void;
  accept?: string;
  fileName?: string | null;
};

export function FileDropzone({
  tool,
  onFile,
  onExtracted,
  accept = "application/pdf,.pdf,image/*",
  fileName,
}: Props) {
  const { t } = useI18n();
  const { setDoc } = useActiveDocument();
  const { entitlement, tryConsume, openUpgrade } = useEntitlement();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);

  const handle = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    // Fast pre-check: if the free trial is already exhausted, prompt to upgrade
    // before spending time on extraction.
    if (entitlement && !entitlement.allowed) {
      openUpgrade();
      return;
    }
    setProgress({ stage: "loading", page: 0, pageCount: 0, percent: 0 });
    try {
      const result = await extractDocument(file, setProgress);
      // Server-enforced, atomic consumption of one processing slot.
      const ok = await tryConsume({ fileName: file.name, fileSize: file.size, tool });
      if (!ok) {
        // tryConsume already opened the upgrade modal.
        toast.error(t("free_limit_reached"));
        return;
      }
      const doc: ActiveDocument = {
        ...result,
        name: file.name,
        sizeKb: Math.round(file.size / 1024),
      };
      addDocument(file.name, doc.sizeKb, tool);
      setDoc(doc);
      onExtracted?.(doc);
      if (!result.text) {
        toast.warning(t("extract_empty"));
      } else {
        toast.success(t("uploaded"));
      }
      onFile(file);
    } catch (err) {
      console.error("[FileDropzone] extraction failed", err);
      toast.error(t("extract_failed"));
    } finally {
      setProgress(null);
    }
  };

  if (progress) {
    const label = progress.stage === "ocr" ? t("ocr_running") : t("extracting");
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/40 bg-card p-10 text-center shadow-soft">
        <span className="grid h-20 w-20 place-items-center rounded-2xl gradient-hero text-primary-foreground shadow-soft">
          <Loader2 className="h-9 w-9 animate-spin" />
        </span>
        <p className="mt-6 text-lg font-medium text-foreground">{label}</p>
        {progress.pageCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.page} / {progress.pageCount} {t("pages_label")}
          </p>
        )}
        <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${Math.max(4, progress.percent)}%` }}
          />
        </div>
      </div>
    );
  }

  if (fileName) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">{fileName}</span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {t("dropzone_replace")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
    );
  }

  return (
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
        handle(e.dataTransfer.files);
      }}
      className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
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
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}

export function ToolHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-1 text-muted-foreground">{desc}</p>
    </div>
  );
}

export function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-soft">
      <span className="inline-flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </span>
      {label}
    </div>
  );
}