import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { WorkflowLoader } from "@/components/pdf/WorkflowLoader";
import { pageHead } from "@/lib/seo";
import { getPdfTool } from "@/lib/pdf-tools";
import { useI18n } from "@/lib/i18n";

const PdfToolWorkspace = lazy(() =>
  import("@/components/pdf/PdfToolWorkspace").then((m) => ({ default: m.PdfToolWorkspace })),
);

export const Route = createFileRoute("/_app/tools/$toolId")({
  ssr: false,
  head: ({ params }) => {
    const tool = getPdfTool(params.toolId);
    return pageHead({
      path: `/tools/${params.toolId}`,
      title: tool ? `PDF Tool — ${params.toolId} | PDF Quanta` : "PDF Tool | PDF Quanta",
      description: "Professional PDF processing with Arabic RTL support.",
    });
  },
  component: ToolPage,
});

function ToolPage() {
  const { toolId } = Route.useParams();
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl py-12">
          <WorkflowLoader label={t("pdf_processing")} percent={12} />
        </div>
      }
    >
      <PdfToolWorkspace toolId={toolId} />
    </Suspense>
  );
}
