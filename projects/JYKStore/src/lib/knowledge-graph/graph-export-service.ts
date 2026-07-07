import { prisma } from "@/lib/prisma";
import {
  GRAPH_SOURCE_AUTO,
  type KnowledgeGraphEdgeDto,
  type KnowledgeGraphNodeDto,
  type KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";
import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";
import { toEdgeDto, toNodeDto } from "./graph-mapper";
import { getKnowledgeGraphSummary } from "./graph-summary-service";

// public export에서 호출된다. PUBLISHED/VERIFIED pack만 허용한다.
export async function exportKnowledgeGraph(packId: string): Promise<{
  summary: KnowledgeGraphSummaryDto;
  nodes: KnowledgeGraphNodeDto[];
  edges: KnowledgeGraphEdgeDto[];
} | null> {
  const publicPack = await prisma.knowledgePack.findFirst({
    where: { packId, status: { in: [...PUBLIC_PACK_STATUSES] } },
    select: { packId: true },
  });
  if (!publicPack) return null;

  const summary = await getKnowledgeGraphSummary(packId);
  if (!summary) return null;

  const [nodes, edges] = await Promise.all([
    prisma.knowledgeGraphNode.findMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
      orderBy: [{ nodeType: "asc" }, { externalId: "asc" }],
    }),
    prisma.knowledgeGraphEdge.findMany({
      where: { packId, source: GRAPH_SOURCE_AUTO },
      orderBy: [{ edgeType: "asc" }],
    }),
  ]);

  return {
    summary,
    nodes: nodes.map(toNodeDto),
    edges: edges.map(toEdgeDto),
  };
}
