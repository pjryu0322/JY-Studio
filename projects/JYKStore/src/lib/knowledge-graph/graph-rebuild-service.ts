import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GRAPH_SOURCE_AUTO,
  type KnowledgeGraphRebuildResultDto,
} from "@/lib/knowledge-graph-dto";
import { planKnowledgeGraph } from "./graph-planner";

export async function rebuildKnowledgeGraph(
  packId: string,
): Promise<KnowledgeGraphRebuildResultDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true, name: true },
  });
  if (!pack) return null;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    include: {
      sourceDocuments: { orderBy: { createdAt: "asc" } },
      chunks: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });

  // version이 없으면 그래프를 비운다.
  const versionId = version?.id ?? null;

  const { nodesByExternalId, edges } = planKnowledgeGraph({
    packId,
    packName: pack.name,
    version,
  });

  const result = await prisma.$transaction(async (tx) => {
    const deletedEdges = await tx.knowledgeGraphEdge.deleteMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
    });
    const deletedNodes = await tx.knowledgeGraphNode.deleteMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
    });

    if (nodesByExternalId.size === 0) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        deletedNodeCount: deletedNodes.count,
        deletedEdgeCount: deletedEdges.count,
      };
    }

    await tx.knowledgeGraphNode.createMany({
      data: Array.from(nodesByExternalId.values()).map((node) => ({
        packId,
        versionId,
        nodeType: node.nodeType,
        externalId: node.externalId,
        label: node.label,
        summary: node.summary,
        metadata: node.metadata,
        source: GRAPH_SOURCE_AUTO,
      })),
      skipDuplicates: true,
    });

    const createdNodes = await tx.knowledgeGraphNode.findMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
      select: { id: true, externalId: true },
    });
    const idByExternalId = new Map(createdNodes.map((n) => [n.externalId, n.id]));

    const edgeData: Prisma.KnowledgeGraphEdgeCreateManyInput[] = [];
    const seen = new Set<string>();
    for (const edge of edges) {
      const fromId = idByExternalId.get(edge.fromExternalId);
      const toId = idByExternalId.get(edge.toExternalId);
      if (!fromId || !toId) continue;
      const dedupeKey = `${edge.edgeType}|${fromId}|${toId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      edgeData.push({
        packId,
        versionId,
        edgeType: edge.edgeType,
        fromNodeId: fromId,
        toNodeId: toId,
        source: GRAPH_SOURCE_AUTO,
      });
    }

    if (edgeData.length > 0) {
      await tx.knowledgeGraphEdge.createMany({ data: edgeData, skipDuplicates: true });
    }

    return {
      nodeCount: createdNodes.length,
      edgeCount: edgeData.length,
      deletedNodeCount: deletedNodes.count,
      deletedEdgeCount: deletedEdges.count,
    };
  });

  return { packId, versionId, ...result };
}
