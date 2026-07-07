import { createFileRoute } from "@tanstack/react-router";

import { PdfToolsHub } from "@/components/pdf/PdfToolsHub";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/tools/")({
  ssr: false,
  head: () =>
    pageHead({
      path: "/tools",
      title: "Integrated PDF Tools — PDF Quanta",
      description:
        "Professional PDF toolkit: convert, merge, split, watermark, compress, edit, sign, and protect PDFs with Arabic layout preservation.",
    }),
  component: ToolsHubPage,
});

function ToolsHubPage() {
  const { t } = useI18n();
  return (
    <>
      <title>{t("pdf_suite_title")}</title>
      <PdfToolsHub />
    </>
  );
}
