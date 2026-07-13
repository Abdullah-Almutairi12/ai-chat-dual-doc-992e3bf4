import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Download, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { ToolHeader } from "@/components/FileDropzone";
import { WorkflowLoader } from "@/components/pdf/WorkflowLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { getPdfTool, type PdfTool } from "@/lib/pdf-tools";
import { sanitizeFileName, validateUpload, type UploadKind } from "@/lib/pdf/security";
import { useEntitlement } from "@/lib/entitlement";
import { consumeProcessingSlot } from "@/lib/pdf-storage";
import { runMasterConversion } from "@/lib/pdf/master-engine-client";
import { validateBatchSize } from "@/lib/pdf/batch";
import type { PdfProgress } from "@/lib/pdf/progress";
import { applyConversionResult, finalizeOutput, logToolError } from "@/lib/pdf/tool-runtime";

type Props = { toolId: string };

export function PdfToolWorkspace({ toolId }: Props) {
  const tool = getPdfTool(toolId);
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { user, isReady: authReady } = useAuth();
  const { openUpgrade, entitlement, loading, refresh: refreshEntitlement } = useEntitlement();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<
    PdfProgress & { label: string }
  >({ label: "", percent: 0, stage: "" });
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState("output.pdf");
  const [processError, setProcessError] = useState<string | null>(null);
  const runLockRef = useRef(false);
  const runIdRef = useRef(0);

  // Tool-specific options
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmRotation, setWmRotation] = useState(-30);
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [deletePageStr, setDeletePageStr] = useState("1");
  const [protectPass, setProtectPass] = useState("");
  const [unlockPass, setUnlockPass] = useState("");
  const [compressLevel, setCompressLevel] = useState<"low" | "medium" | "high">("medium");
  const [addTextContent, setAddTextContent] = useState("");
  const [redactPage, setRedactPage] = useState(1);
  const [reorderStr, setReorderStr] = useState("1,2,3");
  const [signText, setSignText] = useState("");
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  const reportProgress = useCallback(
    (p: PdfProgress) => {
      setProgress({
        label: t("pdf_processing"),
        percent: p.percent,
        stage: p.stage,
        page: p.page,
        pageCount: p.pageCount,
        fileIndex: p.fileIndex,
        fileCount: p.fileCount,
      });
    },
    [t],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef<(batch?: File[]) => Promise<void>>(async () => {});

  if (!tool) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-muted-foreground">{t("pdf_tool_not_found")}</p>
        <Button asChild className="mt-4">
          <Link to="/tools">{t("pdf_back_hub")}</Link>
        </Button>
      </div>
    );
  }

  const uploadKind = (): UploadKind => {
    if (tool.id === "images-pdf") return "image";
    if (tool.id === "office-pdf") return "office";
    if (tool.multiFile && tool.id === "merge") return "pdf";
    return "pdf";
  };

  const pickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    for (const f of picked) {
      const v = validateUpload(f, { kind: uploadKind() });
      if (!v.ok) {
        toast.error(t("invalid_file"));
        return;
      }
    }
    setFiles(picked);
    setResultBlob(null);
    setProcessError(null);
    toast.success(t("uploaded"));

    const readyForAutoRun = !tool.multiFile || picked.length >= 2;
    if (readyForAutoRun && authReady) {
      toast.info(t("pdf_file_ready"));
      queueMicrotask(() => void runRef.current(picked));
    }
  };

  /** Non-blocking entitlement ping — never blocks conversion or persists files. */
  const pingEntitlement = useCallback(
    (batch: File[]) => {
      if (!user) return;
      void consumeProcessingSlot({
        fileName: batch[0]?.name,
        fileSize: batch[0]?.size,
        tool: toolId,
      })
        .then(() => refreshEntitlement())
        .catch(() => {});
    },
    [user, toolId, refreshEntitlement],
  );

  const run = useCallback(
    async (batchOverride?: File[]) => {
      const batch = batchOverride ?? files;
      if (!batch.length) {
        toast.error(t("invalid_file"));
        return;
      }
      if (runLockRef.current) {
        toast.info(t("pdf_processing"));
        return;
      }
      runLockRef.current = true;
      const runId = ++runIdRef.current;

      setProcessing(true);
      setProcessError(null);
      setProgress({ label: t("pdf_processing"), percent: 5, stage: "" });
      setResultBlob(null);

      const onProgress = (p: PdfProgress) => {
        if (runIdRef.current !== runId) return;
        reportProgress(p);
      };

      try {
        if (!user) {
          toast.error(t("pdf_need_login"));
          navigate({ to: "/login", search: { redirect: `/tools/${toolId}` } });
          return;
        }

        if (!loading && entitlement && !entitlement.allowed) {
          openUpgrade();
          return;
        }

        pingEntitlement(batch);

        const base = sanitizeFileName(batch[0].name.replace(/\.\w+$/i, ""));
        const pdf = await import("@/lib/pdf/client-api");

        if (tool!.convertMode) {
          const mode = tool!.convertMode;
          const result = await runMasterConversion(mode, batch[0], { imageFiles: batch }, onProgress);

          if (result.meta.usedFallback) {
            toast.info(t("pdf_vision_fallback"));
          }

          const applied = await applyConversionResult(result, base);
          if (applied?.kind === "single") {
            setResultBlob(applied.blob);
            setResultName(applied.fileName);
            toast.success(t("convert_done"));
          } else if (applied?.kind === "multi") {
            if (applied.downloaded > 0) {
              toast.success(t("convert_done"));
            } else {
              setProcessError(t("pdf_output_invalid"));
              toast.error(t("pdf_output_invalid"));
            }
          } else {
            setProcessError(t("pdf_process_failed"));
            toast.error(t("pdf_process_failed"));
          }
          return;
        }

        if (tool!.id === "merge") {
          const batchCheck = validateBatchSize(batch);
          if (!batchCheck.ok) {
            logToolError(toolId, new Error(`batch_${batchCheck.reason}`));
            setProcessError(t("pdf_batch_too_large"));
            toast.error(t("pdf_batch_too_large"));
            return;
          }
        }

        let blob: Blob | null = null;
        let outName = `${base}.pdf`;

        switch (tool!.id) {
        case "merge":
          blob = await pdf.mergePdfs(batch, onProgress);
          outName = `${base}-merged.pdf`;
          break;
        case "split": {
          const parts = await pdf.splitEveryPage(batch[0], onProgress);
          let downloaded = 0;
          for (const [i, part] of parts.entries()) {
            if (await pdf.validatedDownloadBlob(part, `${base}-part-${i + 1}.pdf`)) downloaded++;
          }
          if (downloaded > 0) toast.success(t("convert_done"));
          else {
            setProcessError(t("pdf_output_invalid"));
            toast.error(t("pdf_output_invalid"));
          }
          return;
        }
        case "rotate":
          blob = await pdf.rotatePages(batch[0], [], rotateAngle, onProgress);
          outName = `${base}-rotated.pdf`;
          break;
        case "delete-pages": {
          const nums = deletePageStr.split(/[,\s]+/).map(Number).filter((n) => n > 0);
          blob = await pdf.deletePages(batch[0], nums, onProgress);
          outName = `${base}-edited.pdf`;
          break;
        }
        case "watermark-add":
          blob = await pdf.addWatermark(
            batch[0],
            { text: wmText, opacity: wmOpacity, rotation: wmRotation },
            onProgress,
          );
          outName = `${base}-watermarked.pdf`;
          break;
        case "watermark-remove":
          blob = await pdf.removeWatermark(batch[0], onProgress);
          outName = `${base}-clean.pdf`;
          break;
        case "compress":
          blob = await pdf.optimizePdf(batch[0], compressLevel, onProgress);
          outName = `${base}-optimized.pdf`;
          break;
        case "add-text":
          blob = await pdf.addTextToPdf(
            batch[0],
            [{ page: 1, x: 72, y: 720, text: addTextContent || "Text" }],
          );
          outName = `${base}-edited.pdf`;
          break;
        case "redact":
          blob = await pdf.redactRegions(batch[0], [
            { page: redactPage, x: 72, y: 700, width: 200, height: 20 },
          ]);
          outName = `${base}-redacted.pdf`;
          break;
        case "reorder": {
          const order = reorderStr.split(/[,\s]+/).map(Number).filter((n) => n > 0);
          blob = await pdf.reorderPages(batch[0], order.length ? order : [1], onProgress);
          outName = `${base}-reordered.pdf`;
          break;
        }
        case "annotate":
          blob = await pdf.applyAnnotations(
            batch[0],
            [{ type: "highlight", page: 1, x: 72, y: 700, width: 200, height: 16 }],
            onProgress,
          );
          outName = `${base}-annotated.pdf`;
          break;
        case "stamp": {
          const bytes = pdf.typedSignatureToBytes("STAMP");
          blob = await pdf.applySignatures(
            batch[0],
            [{ page: 1, x: 400, y: 100, width: 80, height: 80, imageBytes: bytes, label: "Stamp" }],
            onProgress,
          );
          outName = `${base}-stamped.pdf`;
          break;
        }
        case "sign": {
          const bytes = signText
            ? pdf.typedSignatureToBytes(signText)
            : sigCanvasRef.current
              ? await pdf.drawSignatureToBytes(sigCanvasRef.current)
              : pdf.typedSignatureToBytes("Signed");
          blob = await pdf.applySignatures(
            batch[0],
            [{ page: 1, x: 72, y: 100, width: 160, height: 50, imageBytes: bytes }],
            onProgress,
          );
          outName = `${base}-signed.pdf`;
          break;
        }
        case "protect":
          blob = await pdf.protectPdf(
            batch[0],
            { userPassword: protectPass, allowPrinting: false, allowCopying: false },
            onProgress,
          );
          outName = `${base}-protected.pdf`;
          break;
        case "unlock": {
          const { removeProtection, unlockPdfFallback } = await import("@/lib/pdf/protect");
          blob = await removeProtection(batch[0], unlockPass, onProgress).catch(() => null);
          if (!blob) {
            logToolError(toolId, new Error("unlock_primary_failed"));
            blob = await unlockPdfFallback(batch[0]).catch(() => null);
          }
          outName = `${base}-unlocked.pdf`;
          break;
        }
        default:
          toast.error(t("pdf_tool_not_found"));
          return;
        }

        if (!blob) {
          setProcessError(t("pdf_process_failed"));
          toast.error(t("pdf_process_failed"));
          return;
        }

        const valid = await finalizeOutput(blob, outName);
        if (!valid) {
          logToolError(toolId, new Error("invalid_output"));
          setProcessError(t("pdf_output_invalid"));
          toast.error(t("pdf_output_invalid"));
          return;
        }

        setResultBlob(valid);
        setResultName(outName);
        toast.success(t("convert_done"));
    } catch (err) {
      if (runIdRef.current === runId) {
        logToolError(toolId, err);
        setProcessError(t("pdf_process_failed"));
        setProgress((prev) => ({ ...prev, label: t("pdf_process_failed"), stage: "error" }));
        toast.error(t("pdf_process_failed"));
      }
    } finally {
      if (runIdRef.current === runId) {
        setProcessing(false);
        runLockRef.current = false;
      }
    }
  },
    [
      files,
      tool,
      toolId,
      t,
      user,
      navigate,
      entitlement,
      loading,
      openUpgrade,
      refreshEntitlement,
      reportProgress,
      pingEntitlement,
      wmText,
      wmOpacity,
      wmRotation,
      rotateAngle,
      deletePageStr,
      protectPass,
      unlockPass,
      compressLevel,
      addTextContent,
      redactPage,
      reorderStr,
      signText,
    ],
  );
  runRef.current = run;

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const pt = pointer(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pt = pointer(e, canvas);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/tools"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
        {t("pdf_back_hub")}
      </Link>

      <ToolHeader title={t(tool.titleKey)} desc={t(tool.descKey)} />

      <div
        className="mt-6 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors hover:border-primary/40"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pickFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm font-medium text-foreground">{t("dropzone_text")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("dropzone_hint")}</p>
        {files.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-primary">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={tool.accept ?? "application/pdf,.pdf"}
          multiple={tool.multiFile}
          onChange={(e) => pickFiles(e.target.files)}
        />
      </div>

      <ToolOptions
        tool={tool}
        wmText={wmText}
        setWmText={setWmText}
        wmOpacity={wmOpacity}
        setWmOpacity={setWmOpacity}
        wmRotation={wmRotation}
        setWmRotation={setWmRotation}
        rotateAngle={rotateAngle}
        setRotateAngle={setRotateAngle}
        deletePageStr={deletePageStr}
        setDeletePageStr={setDeletePageStr}
        protectPass={protectPass}
        setProtectPass={setProtectPass}
        unlockPass={unlockPass}
        setUnlockPass={setUnlockPass}
        compressLevel={compressLevel}
        setCompressLevel={setCompressLevel}
        addTextContent={addTextContent}
        setAddTextContent={setAddTextContent}
        redactPage={redactPage}
        setRedactPage={setRedactPage}
        reorderStr={reorderStr}
        setReorderStr={setReorderStr}
        signText={signText}
        setSignText={setSignText}
        sigCanvasRef={sigCanvasRef}
        startDraw={startDraw}
        draw={draw}
        endDraw={endDraw}
        t={t}
      />

      <div className="mt-6 flex justify-end">
        <Button onClick={() => void run()} disabled={!files.length || processing || !authReady} className="gap-2">
          <Play className="h-4 w-4" />
          {t("pdf_run_tool")}
        </Button>
      </div>

      {processing && (
        <div className="mt-6">
          <WorkflowLoader
            label={progress.label}
            percent={progress.percent}
            stage={progress.stage}
            page={progress.page}
            pageCount={progress.pageCount}
            fileIndex={progress.fileIndex}
            fileCount={progress.fileCount}
          />
        </div>
      )}

      {processError && !processing && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 shadow-soft">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-destructive">{processError}</p>
            {progress.stage === "error" && progress.percent > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{progress.percent}%</p>
            ) : null}
            <Button
              variant="outline"
              className="mt-4 gap-2"
              disabled={!files.length}
              onClick={() => {
                setProcessError(null);
                void run();
              }}
            >
              <Play className="h-4 w-4" />
              {t("quiz_retry")}
            </Button>
          </div>
        </div>
      )}

      {resultBlob && !processing && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{t("convert_result_title")}</p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                const { validatedDownloadBlob } = await import("@/lib/pdf/security");
                const ok = await validatedDownloadBlob(resultBlob, resultName);
                if (!ok) toast.error(t("pdf_output_invalid"));
              }}
            >
              <Download className="h-4 w-4" />
              {t("convert_download")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{resultName}</p>
        </div>
      )}
    </div>
  );
}

function ToolOptions(props: {
  tool: PdfTool;
  wmText: string;
  setWmText: (v: string) => void;
  wmOpacity: number;
  setWmOpacity: (v: number) => void;
  wmRotation: number;
  setWmRotation: (v: number) => void;
  rotateAngle: 90 | 180 | 270;
  setRotateAngle: (v: 90 | 180 | 270) => void;
  deletePageStr: string;
  setDeletePageStr: (v: string) => void;
  protectPass: string;
  setProtectPass: (v: string) => void;
  unlockPass: string;
  setUnlockPass: (v: string) => void;
  compressLevel: "low" | "medium" | "high";
  setCompressLevel: (v: "low" | "medium" | "high") => void;
  addTextContent: string;
  setAddTextContent: (v: string) => void;
  redactPage: number;
  setRedactPage: (v: number) => void;
  reorderStr: string;
  setReorderStr: (v: string) => void;
  signText: string;
  setSignText: (v: string) => void;
  sigCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  startDraw: (e: React.MouseEvent | React.TouchEvent) => void;
  draw: (e: React.MouseEvent | React.TouchEvent) => void;
  endDraw: () => void;
  t: (k: import("@/lib/translations").TranslationKey) => string;
}) {
  const { tool, t } = props;
  if (tool.id === "watermark-add") {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Input value={props.wmText} onChange={(e) => props.setWmText(e.target.value)} placeholder={t("pdf_wm_text")} />
        <Input type="number" min={0.1} max={1} step={0.1} value={props.wmOpacity} onChange={(e) => props.setWmOpacity(Number(e.target.value))} placeholder={t("pdf_wm_opacity")} />
        <Input type="number" value={props.wmRotation} onChange={(e) => props.setWmRotation(Number(e.target.value))} placeholder={t("pdf_wm_rotation")} />
      </div>
    );
  }
  if (tool.id === "rotate") {
    return (
      <div className="mt-6 flex gap-2">
        {([90, 180, 270] as const).map((a) => (
          <Button key={a} variant={props.rotateAngle === a ? "default" : "outline"} onClick={() => props.setRotateAngle(a)}>
            {a}°
          </Button>
        ))}
      </div>
    );
  }
  if (tool.id === "delete-pages") {
    return (
      <div className="mt-6">
        <Input value={props.deletePageStr} onChange={(e) => props.setDeletePageStr(e.target.value)} placeholder={t("pdf_pages_to_delete")} />
      </div>
    );
  }
  if (tool.id === "reorder") {
    return (
      <div className="mt-6">
        <Input value={props.reorderStr} onChange={(e) => props.setReorderStr(e.target.value)} placeholder="1,3,2,4" dir="ltr" />
      </div>
    );
  }
  if (tool.id === "compress") {
    return (
      <div className="mt-6 flex gap-2">
        {(["low", "medium", "high"] as const).map((l) => (
          <Button key={l} variant={props.compressLevel === l ? "default" : "outline"} onClick={() => props.setCompressLevel(l)}>
            {t(l === "low" ? "pdf_compress_low" : l === "medium" ? "pdf_compress_med" : "pdf_compress_high")}
          </Button>
        ))}
      </div>
    );
  }
  if (tool.id === "add-text") {
    return (
      <div className="mt-6">
        <Textarea value={props.addTextContent} onChange={(e) => props.setAddTextContent(e.target.value)} placeholder={t("pdf_add_text_ph")} dir="auto" />
      </div>
    );
  }
  if (tool.id === "redact") {
    return (
      <div className="mt-6">
        <Input type="number" min={1} value={props.redactPage} onChange={(e) => props.setRedactPage(Number(e.target.value))} placeholder={t("pdf_redact_page")} />
      </div>
    );
  }
  if (tool.id === "sign") {
    return (
      <div className="mt-6 space-y-3">
        <Input value={props.signText} onChange={(e) => props.setSignText(e.target.value)} placeholder={t("pdf_sign_type")} dir="auto" />
        <p className="text-xs text-muted-foreground">{t("pdf_sign_draw")}</p>
        <canvas
          ref={props.sigCanvasRef}
          width={400}
          height={100}
          className="w-full rounded-xl border border-border bg-white touch-none"
          onMouseDown={props.startDraw}
          onMouseMove={props.draw}
          onMouseUp={props.endDraw}
          onMouseLeave={props.endDraw}
          onTouchStart={props.startDraw}
          onTouchMove={props.draw}
          onTouchEnd={props.endDraw}
        />
      </div>
    );
  }
  if (tool.id === "protect") {
    return (
      <div className="mt-6">
        <Input type="password" value={props.protectPass} onChange={(e) => props.setProtectPass(e.target.value)} placeholder={t("pdf_password")} />
      </div>
    );
  }
  if (tool.id === "unlock") {
    return (
      <div className="mt-6">
        <Input type="password" value={props.unlockPass} onChange={(e) => props.setUnlockPass(e.target.value)} placeholder={t("pdf_password")} />
      </div>
    );
  }
  return null;
}

function pointer(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  if ("touches" in e) {
    return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
  }
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}
