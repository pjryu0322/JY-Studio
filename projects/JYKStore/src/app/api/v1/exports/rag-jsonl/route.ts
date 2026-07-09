import { buildRagJsonlExport } from "@/lib/knowledge-export-service";
import { createPublicExportRoute } from "@/lib/public-export-route";

export const GET = createPublicExportRoute({
  build: buildRagJsonlExport,
  metadata: (jsonl) => ({
    exportType: "JYKSTORE_RAG_JSONL",
    lineCount: jsonl ? jsonl.split("\n").filter(Boolean).length : 0,
  }),
  response: (jsonl, packId) =>
    new Response(jsonl, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${packId}-rag.jsonl"`,
      },
    }),
});
