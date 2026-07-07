import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GRAPH_SOURCE_AUTO,
  type KnowledgeGraphEdgeDto,
  type KnowledgeGraphQueryResponseDto,
} from "@/lib/knowledge-graph-dto";
import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";
import { toEdgeDto, toNodeDto } from "./graph-mapper";

export async function queryKnowledgeGraph(input: {
  knowledgePackId: string;
  query?: string;
  nodeTypes?: string[];
  edgeTypes?: string[];
  limit: number;
  includeEdges: boolean;
  requestId: string;
}): Promise<KnowledgeGraphQueryResponseDto | null> {
  // public graph query: PUBLISHED/VERIFIED pack만 허용한다. 비공개 pack이면 null(404).
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: input.knowledgePackId,
      status: { in: [...PUBLIC_PACK_STATUSES] },
    },
    select: { packId: true },
  });
  if (!pack) return null;

  const where: Prisma.KnowledgeGraphNodeWhereInput = {
    packId: input.knowledgePackId,
    source: GRAPH_SOURCE_AUTO,
  };

  if (input.nodeTypes && input.nodeTypes.length > 0) {
    where.nodeType = { in: input.nodeTypes };
  }

  const trimmedQuery = input.query?.trim();
  if (trimmedQuery) {
    where.OR = [
      { label: { contains: trimmedQuery, mode: "insensitive" } },
      { summary: { contains: trimmedQuery, mode: "insensitive" } },
      { externalId: { contains: trimmedQuery, mode: "insensitive" } },
    ];
  }

  const nodes = await prisma.knowledgeGraphNode.findMany({
    where,
    orderBy: [{ nodeType: "asc" }, { externalId: "asc" }],
    take: input.limit,
  });

  let edges: KnowledgeGraphEdgeDto[] = [];
  if (input.includeEdges && nodes.length > 0) {
    const nodeIds = nodes.map((n) => n.id);
    const edgeWhere: Prisma.KnowledgeGraphEdgeWhereInput = {
      packId: input.knowledgePackId,
      source: GRAPH_SOURCE_AUTO,
      fromNodeId: { in: nodeIds },
      toNodeId: { in: nodeIds },
    };
    if (input.edgeTypes && input.edgeTypes.length > 0) {
      edgeWhere.edgeType = { in: input.edgeTypes };
    }
    const edgeRows = await prisma.knowledgeGraphEdge.findMany({ where: edgeWhere });
    edges = edgeRows.map(toEdgeDto);
  }

  return {
    nodes: nodes.map(toNodeDto),
    edges,
    usage: {
      requestId: input.requestId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      limit: input.limit,
    },
  };
}
