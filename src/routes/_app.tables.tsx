import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Sheet as SheetIcon } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone, LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/tables")({
  head: () =>
    pageHead({
      path: "/tables",
      title: "PDF to Excel — Extract Tables from PDF | PDF Quanta",
      description:
        "Extract tables from any PDF and export clean, structured data to Excel or CSV. PDF Quanta detects rows and columns automatically with AI.",
    }),
  component: TablesTool,
});

type DetectedTable = { name: string; headers: string[]; rows: (string | number)[][] };

const sampleTables: DetectedTable[] = [
  {
    name: "Quarterly Revenue",
    headers: ["Quarter", "Revenue", "Growth"],
    rows: [
      ["Q1", 120000, "8%"],
      ["Q2", 138000, "15%"],
      ["Q3", 155000, "12%"],
      ["Q4", 189000, "22%"],
    ],
  },
  {
    name: "Regional Breakdown",
    headers: ["Region", "Units", "Share"],
    rows: [
      ["North", 4200, "34%"],
      ["South", 3100, "25%"],
      ["East", 2800, "23%"],
      ["West", 2200, "18%"],
    ],
  },
];

function TablesTool() {
  const { t } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tablesData, setTablesData] = useState<DetectedTable[] | null>(null);

  const onFile = (f: File) => {
    setFile(f.name);
    setScanning(true);
    setTablesData(null);
    setTimeout(() => {
      setTablesData(sampleTables);
      setScanning(false);
    }, 1200);
  };

  const download = async () => {
    if (!tablesData) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    tablesData.forEach((tbl) => {
      const ws = XLSX.utils.aoa_to_sheet([tbl.headers, ...tbl.rows]);
      XLSX.utils.book_append_sheet(wb, ws, tbl.name.slice(0, 31));
    });
    XLSX.writeFile(wb, `${(file ?? "tables").replace(/\.pdf$/i, "")}-tables.xlsx`);
    toast.success(t("tables_downloaded"));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ToolHeader title={t("tool_tables")} desc={t("tool_tables_desc")} />

      <FileDropzone tool="tables" onFile={onFile} fileName={file} />

      {scanning && (
        <div className="mt-6">
          <LoadingRow label={t("tables_scan")} />
        </div>
      )}

      {tablesData && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("tables_detected")}</h2>
              <p className="text-sm text-muted-foreground">{t("tables_hint")}</p>
            </div>
            <Button onClick={download} className="gap-2 shadow-soft">
              <Download className="h-4 w-4" />
              {t("tables_download")}
            </Button>
          </div>

          {tablesData.map((tbl) => (
            <div key={tbl.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="flex items-center gap-2 border-b border-border bg-accent/40 px-4 py-3">
                <SheetIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{tbl.name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {tbl.headers.map((h) => (
                        <th key={h} className="px-4 py-2.5 text-start font-semibold text-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5 text-muted-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}