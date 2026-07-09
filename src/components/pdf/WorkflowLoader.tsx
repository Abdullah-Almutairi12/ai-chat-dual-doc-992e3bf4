import { Loader2 } from "lucide-react";

type Props = {
  label: string;
  percent: number;
  stage?: string;
  page?: number;
  pageCount?: number;
  fileIndex?: number;
  fileCount?: number;
};

export function WorkflowLoader({ label, percent, stage, page, pageCount, fileIndex, fileCount }: Props) {
  const multiFile = fileCount && fileCount > 1 && fileIndex !== undefined;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
      <span className="grid h-16 w-16 place-items-center rounded-2xl gradient-hero text-primary-foreground shadow-soft">
        <Loader2 className="h-8 w-8 animate-spin" />
      </span>
      <p className="mt-5 text-base font-medium text-foreground">{label}</p>
      {stage ? <p className="mt-1 text-sm text-muted-foreground capitalize">{stage.replace(/-/g, " ")}</p> : null}
      {multiFile ? (
        <p className="mt-1 text-xs text-muted-foreground">
          File {fileIndex} / {fileCount}
        </p>
      ) : null}
      {pageCount ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {page ?? 0} / {pageCount}
        </p>
      ) : null}
      <div className="mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-primary">{percent}%</p>
    </div>
  );
}
