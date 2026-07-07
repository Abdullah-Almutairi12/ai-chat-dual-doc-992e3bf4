import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Layout for /tools/* — child routes (e.g. /tools/watermark-add) render in <Outlet />.
 * The hub grid lives at /tools exactly (see _app.tools.index.tsx).
 */
export const Route = createFileRoute("/_app/tools")({
  ssr: false,
  component: ToolsLayout,
});

function ToolsLayout() {
  return <Outlet />;
}
