import { EXPORT_VERSION, type GraphExportDto } from "@/lib/knowledge-export-dto";
import { exportKnowledgeGraph } from "@/lib/knowledge-graph/graph-export-service";
import { buildExportGeneratedAt } from "./export-shared";

export async function buildGraphExport(packId: string): Promise<GraphExportDto | null> {
  const graph = await exportKnowledgeGraph(packId);
  if (!graph) return null;

  return {
    exportType: "JYKSTORE_GRAPH_JSON",
    exportVersion: EXPORT_VERSION,
    generatedAt: buildExportGeneratedAt(),
    knowledgePackId: packId,
    summary: graph.summary,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}
