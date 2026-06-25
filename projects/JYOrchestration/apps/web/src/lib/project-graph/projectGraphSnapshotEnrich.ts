import { getProjectGraphSnapshot } from "@/lib/project-graph/projectGraphQuery";
import { buildKnowledgeNodeReferenceView } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import { enrichGraphNodesWithExplainability } from "@/lib/project-structure/projectStructureExplainabilityService";

export async function getProjectGraphSnapshotWithExplainability(
  projectId: string,
  filters?: Parameters<typeof getProjectGraphSnapshot>[1],
) {
  const { nodes, edges } = await getProjectGraphSnapshot(projectId, filters);
  const enrichedNodes = await enrichGraphNodesWithExplainability(projectId, nodes, edges);
  const nodesWithReference = enrichedNodes.map((n) => ({
    ...n,
    knowledgeReference: buildKnowledgeNodeReferenceView({
      nodeType: n.nodeType,
      title: n.title,
      summary: n.summary,
      lifecycleStatus: n.lifecycleStatus,
      projectionKey: n.projectionKey,
      metadata: n.metadata,
      sourceEventId: n.sourceEventId,
      explainability: n.explainability,
    }),
  }));
  return { nodes: nodesWithReference, edges };
}
