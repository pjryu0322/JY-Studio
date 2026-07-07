import { prisma } from "@/lib/prisma";
import {
  GRAPH_SOURCE_AUTO,
  type KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";

async function getLatestVersion(packId: string) {
  return prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true },
  });
}

export async function getKnowledgeGraphSummary(
  packId: string,
): Promise<KnowledgeGraphSummaryDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true },
  });
  if (!pack) return null;

  const version = await getLatestVersion(packId);

  const [nodes, edges] = await Promise.all([
    prisma.knowledgeGraphNode.findMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
      select: { nodeType: true },
    }),
    prisma.knowledgeGraphEdge.findMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
      select: { edgeType: true },
    }),
  ]);

  const nodeTypeCounts: Record<string, number> = {};
  for (const node of nodes) nodeTypeCounts[node.nodeType] = (nodeTypeCounts[node.nodeType] ?? 0) + 1;
  const edgeTypeCounts: Record<string, number> = {};
  for (const edge of edges) edgeTypeCounts[edge.edgeType] = (edgeTypeCounts[edge.edgeType] ?? 0) + 1;

  return {
    packId,
    versionId: version?.id ?? null,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypeCounts,
    edgeTypeCounts,
  };
}
