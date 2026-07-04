import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { addDocument } from "@/lib/documents";

type Props = {
  tool: string;
  onFile: (file: File) => void;
  accept?: string;
  fileName?: string | null;
};

export function FileDropzone({ tool, onFile, accept = "application/pdf,.pdf", fileName }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    addDocument(file.name, Math.round(file.size / 1024), tool);
    toast.success(t("uploaded"));
    onFile(file);
  };

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