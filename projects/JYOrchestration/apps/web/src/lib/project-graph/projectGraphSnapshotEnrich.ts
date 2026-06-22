import { getProjectGraphSnapshot } from "@/lib/project-graph/projectGraphQuery";
import { enrichGraphNodesWithExplainability } from "@/lib/project-structure/projectStructureExplainabilityService";

export async function getProjectGraphSnapshotWithExplainability(
  projectId: string,
  filters?: Parameters<typeof getProjectGraphSnapshot>[1],
) {
  const { nodes, edges } = await getProjectGraphSnapshot(projectId, filters);
  const enrichedNodes = await enrichGraphNodesWithExplainability(projectId, nodes);
  return { nodes: enrichedNodes, edges };
}
