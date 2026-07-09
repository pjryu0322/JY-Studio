import { buildGraphExport } from "@/lib/knowledge-export-service";
import { createPublicExportRoute } from "@/lib/public-export-route";

export const GET = createPublicExportRoute({
  build: buildGraphExport,
  metadata: (data) => ({
    exportType: data.exportType,
    nodeCount: data.summary.nodeCount,
    edgeCount: data.summary.edgeCount,
  }),
  response: (data, packId) =>
    new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${packId}-graph.json"`,
      },
    }),
});
