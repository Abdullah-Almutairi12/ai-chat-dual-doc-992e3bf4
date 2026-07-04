import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { listDocuments, deleteDocument } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: DocumentsPage,
});

type DocRow = {
  id: string;
  user_email: string;
  file_name: string;
  file_size: number;
  tool_used: string;
  created_at: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsPage() {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<DocRow | null>(null);

  const listFn = useServerFn(listDocuments);
  const deleteFn = useServerFn(deleteDocument);
  const { data, isLoading } = useQuery({ queryKey: ["admin-documents"], queryFn: () => listFn() });

  const mutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success(tt("deleted"));
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = ((data as DocRow[] | undefined) ?? []).filter(
    (d) =>
      d.file_name.toLowerCase().includes(q.toLowerCase()) ||
      d.user_email.toLowerCase().includes(q.toLowerCase()),
  );

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString(lang === "ar" ? "ar" : "en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{tt("documents_title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("documents_subtitle")}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tt("search_users")}
            className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{tt("col_file")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_size")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_tool")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_uploaded")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tt("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {tt("no_results")}
                  </td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                        <span className="truncate">{d.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.user_email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatSize(d.file_size)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                        {d.tool_used}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          onClick={() => toast.info(d.file_name)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">{tt("view")}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setPending(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">{tt("delete")}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tt("delete")}</AlertDialogTitle>
            <AlertDialogDescription>{tt("confirm_delete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tt("back_home")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending && mutation.mutate(pending.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tt("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}