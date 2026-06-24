import { prisma } from "@/lib/prisma";
import {
  syncProjectGraphProjectionAfterEventIds,
  syncProjectGraphProjectionForProject,
} from "@/lib/project-graph/projectGraphProjection";

export async function countProjectGraphTotals(projectId: string): Promise<{
  graphNodeCount: number;
  graphEdgeCount: number;
}> {
  const pid = projectId.trim();
  const [graphNodeCount, graphEdgeCount] = await Promise.all([
    prisma.projectGraphNode.count({ where: { projectId: pid } }),
    prisma.projectGraphEdge.count({ where: { projectId: pid } }),
  ]);
  return { graphNodeCount, graphEdgeCount };
}

export async function syncProjectGraphProjectionWithTotals(
  projectId: string,
  eventIds?: readonly string[],
): Promise<{ appliedCount: number; graphNodeCount: number; graphEdgeCount: number }> {
  const syncResult = eventIds?.length
    ? await syncProjectGraphProjectionAfterEventIds(projectId, eventIds)
    : await syncProjectGraphProjectionForProject(projectId);
  const totals = await countProjectGraphTotals(projectId);
  return {
    appliedCount: syncResult.appliedCount ?? 0,
    ...totals,
  };
}
