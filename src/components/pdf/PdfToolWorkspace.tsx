import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { ToolHeader } from "@/components/FileDropzone";
import { WorkflowLoader } from "@/components/pdf/WorkflowLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { STORAGE_BUCKETS } from "@/integrations/supabase/storage-buckets";
import { useI18n } from "@/lib/i18n";
import { getPdfTool, type PdfTool } from "@/lib/pdf-tools";
import { sanitizeFileName, validateUpload, type UploadKind } from "@/lib/pdf/security";
import { useEntitlement } from "@/lib/entitlement";
import { addDocument } from "@/lib/documents";
import { consumeProcessingSlot, persistProcessedFile, uploadFileViaApi } from "@/lib/pdf-storage";

type Props = { toolId: string };

export function PdfToolWorkspace({ toolId }: Props) {
  const tool = getPdfTool(toolId);
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { user, isReady: authReady } = useAuth();
  const { tryConsume, openUpgrade, entitlement, refresh: refreshEntitlement } = useEntitlement();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ label: "", percent: 0, stage: "" });
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState("output.pdf");
  const runLockRef = useRef(false);

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
    toast.success(t("uploaded"));

    const readyForAutoRun = !tool.multiFile || picked.length >= 2;
    if (readyForAutoRun && authReady) {
      toast.info(t("pdf_file_ready"));
      queueMicrotask(() => void runRef.current(picked));
    }
  };

  const consumeSlot = async (batch: File[]) => {
    if (!user) {
      toast.error(t("pdf_need_login"));
      navigate({ to: "/login", search: { redirect: `/tools/${toolId}` } });
      return false;
    }
    if (entitlement && !entitlement.allowed) {
      openUpgrade();
      return false;
    }

    const meta = {
      fileName: batch[0]?.name,
      fileSize: batch[0]?.size,
      tool: toolId,
    };

    const viaApi = await consumeProcessingSlot(meta);
    if (viaApi) {
      if (!viaApi.allowed) {
        toast.error(t("free_limit_reached"));
        openUpgrade();
        return false;
      }
      await refreshEntitlement();
      if (batch[0]) addDocument(batch[0].name, Math.round(batch[0].size / 1024), toolId);
      return true;
    }

    const ok = await tryConsume(meta);
    if (!ok) {
      toast.error(t("free_limit_reached"));
      return false;
    }
    if (batch[0]) addDocument(batch[0].name, Math.round(batch[0].size / 1024), toolId);
    return true;
  };

  const persistUploads = async (batch: File[], output?: { blob: Blob; name: string }) => {
    if (!user) return;
    for (const f of batch) {
      await uploadFileViaApi(f, { bucket: STORAGE_BUCKETS.pdfTools, toolId });
    }
    if (output) {
      await persistProcessedFile(user.id, output.blob, {
        bucket: STORAGE_BUCKETS.documents,
        toolId,
        fileName: output.name,
      });
    }
  };

  const run = useCallback(
    async (batchOverride?: File[]) => {
      const batch = batchOverride ?? files;
      if (!batch.length) {
        toast.error(t("invalid_file"));
        return;
      }
      if (runLockRef.current) return;
      runLockRef.current = true;

      if (!user) {
        toast.error(t("pdf_need_login"));
        navigate({ to: "/login", search: { redirect: `/tools/${toolId}` } });
        runLockRef.current = false;
        return;
      }

      if (!(await consumeSlot(batch))) {
        runLockRef.current = false;
        return;
      }

      setProcessing(true);
      setProgress({ label: t("pdf_processing"), percent: 5, stage: "" });
      setResultBlob(null);

      try {
        const base = sanitizeFileName(batch[0].name.replace(/\.\w+$/i, ""));
        const pdf = await import("@/lib/pdf/client-api");

        if (tool!.convertMode) {
          const result = await pdf.runConversion(
            tool!.convertMode,
            batch[0],
            { imageFiles: batch },
            (p) => setProgress({ label: t("pdf_processing"), percent: p.percent, stage: p.stage }),
          );
          if (result.blob) {
            setResultBlob(result.blob);
            setResultName(`${base}.${result.ext}`);
            await persistUploads(batch, { blob: result.blob, name: `${base}.${result.ext}` });
          } else if (result.blobs) {
            for (const b of result.blobs) pdf.downloadBlob(b.blob, b.name);
            await persistUploads(batch);
            toast.success(t("convert_done"));
          }
          setProcessing(false);
          runLockRef.current = false;
          return;
        }

        let blob: Blob;
        let outName = `${base}.pdf`;
        switch (tool!.id) {
        case "merge":
          blob = await pdf.mergePdfs(batch);
          outName = `${base}-merged.pdf`;
          break;
        case "split": {
          const parts = await pdf.splitEveryPage(batch[0]);
          for (const [i, b] of parts.entries()) {
            pdf.downloadBlob(b, `${base}-part-${i + 1}.pdf`);
          }
          await persistUploads(batch);
          toast.success(t("convert_done"));
          setProcessing(false);
          runLockRef.current = false;
          return;
        }
        case "rotate":
          blob = await pdf.rotatePages(batch[0], [], rotateAngle);
          outName = `${base}-rotated.pdf`;
          break;
        case "delete-pages": {
          const nums = deletePageStr.split(/[,\s]+/).map(Number).filter((n) => n > 0);
          blob = await pdf.deletePages(batch[0], nums);
          outName = `${base}-edited.pdf`;
          break;
        }
        case "watermark-add":
          blob = await pdf.addWatermark(batch[0], { text: wmText, opacity: wmOpacity, rotation: wmRotation });
          outName = `${base}-watermarked.pdf`;
          break;
        case "watermark-remove":
          blob = await pdf.removeWatermark(batch[0], (p) =>
            setProgress({ label: t("pdf_wm_scanning"), percent: p, stage: "" }),
          );
          outName = `${base}-clean.pdf`;
          break;
        case "compress":
          blob = await pdf.optimizePdf(batch[0], compressLevel);
          outName = `${base}-optimized.pdf`;
          break;
        case "add-text":
          blob = await pdf.addTextToPdf(batch[0], [{ page: 1, x: 72, y: 720, text: addTextContent || "Text" }]);
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
          blob = await pdf.reorderPages(batch[0], order.length ? order : [1]);
          outName = `${base}-reordered.pdf`;
          break;
        }
        case "annotate":
          blob = await pdf.applyAnnotations(batch[0], [
            { type: "highlight", page: 1, x: 72, y: 700, width: 200, height: 16 },
          ]);
          outName = `${base}-annotated.pdf`;
          break;
        case "stamp": {
          const bytes = pdf.typedSignatureToBytes("STAMP");
          blob = await pdf.applySignatures(batch[0], [{ page: 1, x: 400, y: 100, width: 80, height: 80, imageBytes: bytes, label: "Stamp" }]);
          outName = `${base}-stamped.pdf`;
          break;
        }
        case "sign": {
          const bytes = signText
            ? pdf.typedSignatureToBytes(signText)
            : sigCanvasRef.current
              ? await pdf.drawSignatureToBytes(sigCanvasRef.current)
              : pdf.typedSignatureToBytes("Signed");
          blob = await pdf.applySignatures(batch[0], [{ page: 1, x: 72, y: 100, width: 160, height: 50, imageBytes: bytes }]);
          outName = `${base}-signed.pdf`;
          break;
        }
        case "protect":
          blob = await pdf.protectPdf(batch[0], { userPassword: protectPass, allowPrinting: false, allowCopying: false });
          outName = `${base}-protected.pdf`;
          break;
        case "unlock":
          blob = await pdf.removeProtection(batch[0], unlockPass);
          outName = `${base}-unlocked.pdf`;
          break;
        default:
          toast.error(t("pdf_tool_not_found"));
          setProcessing(false);
          runLockRef.current = false;
          return;
      }

      setResultBlob(blob);
      setResultName(outName);
      await persistUploads(batch, { blob, name: outName });
      toast.success(t("convert_done"));
    } catch (err) {
      console.error("[PdfToolWorkspace]", err);
      const message = err instanceof Error ? err.message : t("extract_failed");
      toast.error(message || t("extract_failed"));
    } finally {
      setProcessing(false);
      runLockRef.current = false;
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
      tryConsume,
      openUpgrade,
      refreshEntitlement,
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
          <WorkflowLoader label={progress.label} percent={progress.percent} stage={progress.stage} />
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
                const { downloadBlob } = await import("@/lib/pdf/security");
                downloadBlob(resultBlob, resultName);
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
