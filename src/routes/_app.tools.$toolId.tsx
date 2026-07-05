import { createFileRoute } from "@tanstack/react-router";

import { PdfToolWorkspace } from "@/components/pdf/PdfToolWorkspace";
import { pageHead } from "@/lib/seo";
import { getPdfTool } from "@/lib/pdf-tools";

export const Route = createFileRoute("/_app/tools/$toolId")({
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
  return <PdfToolWorkspace toolId={toolId} />;
}
