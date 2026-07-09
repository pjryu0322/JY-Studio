import { buildMcpReadyManifest } from "@/lib/knowledge-export-service";
import { createPublicExportRoute } from "@/lib/public-export-route";

export const GET = createPublicExportRoute({
  build: buildMcpReadyManifest,
  metadata: (data) => ({
    exportType: data.manifestType,
  }),
  response: (data, packId) =>
    new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${packId}-mcp-manifest.json"`,
      },
    }),
});
