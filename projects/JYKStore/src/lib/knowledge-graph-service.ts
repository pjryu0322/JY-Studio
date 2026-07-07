import type { KnowledgeGraphEdge, KnowledgeGraphNode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GRAPH_SOURCE_AUTO,
  normalizeGraphToken,
  type KnowledgeGraphEdgeDto,
  type KnowledgeGraphNodeDto,
  type KnowledgeGraphQueryResponseDto,
  type KnowledgeGraphRebuildResultDto,
  type KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";
import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toNodeDto(node: KnowledgeGraphNode): KnowledgeGraphNodeDto {
  return {
    id: node.id,
    packId: node.packId,
    versionId: node.versionId,
    nodeType: node.nodeType,
    externalId: node.externalId,
    label: node.label,
    summary: node.summary,
    metadata: toRecord(node.metadata),
  };
}

function toEdgeDto(edge: KnowledgeGraphEdge): KnowledgeGraphEdgeDto {
  return {
    id: edge.id,
    packId: edge.packId,
    versionId: edge.versionId,
    edgeType: edge.edgeType,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    weight: edge.weight,
    metadata: toRecord(edge.metadata),
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

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
  const pack = await prisma.knowledgePack.findUnique({ where: { packId }, select: { packId: true } });
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

type PlannedNode = {
  externalId: string;
  nodeType: string;
  label: string;
  summary: string | null;
  metadata: Prisma.InputJsonValue | undefined;
};

type PlannedEdge = {
  edgeType: string;
  fromExternalId: string;
  toExternalId: string;
};

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

  const nodesByExternalId = new Map<string, PlannedNode>();
  const edges: PlannedEdge[] = [];

  const addNode = (node: PlannedNode) => {
    if (!nodesByExternalId.has(node.externalId)) {
      nodesByExternalId.set(node.externalId, node);
    }
  };

  const packExternalId = `pack:${packId}`;
  if (version) {
    addNode({
      externalId: packExternalId,
      nodeType: "PACK",
      label: pack.name,
      summary: null,
      metadata: undefined,
    });

    const versionExternalId = `version:${version.id}`;
    addNode({
      externalId: versionExternalId,
      nodeType: "VERSION",
      label: `v${version.version}`,
      summary: null,
      metadata: undefined,
    });
    edges.push({
      edgeType: "PACK_HAS_VERSION",
      fromExternalId: packExternalId,
      toExternalId: versionExternalId,
    });

    for (const doc of version.sourceDocuments) {
      const docExternalId = `source-document:${doc.id}`;
      addNode({
        externalId: docExternalId,
        nodeType: "SOURCE_DOCUMENT",
        label: doc.title,
        summary: null,
        metadata: undefined,
      });
      edges.push({
        edgeType: "VERSION_HAS_SOURCE_DOCUMENT",
        fromExternalId: versionExternalId,
        toExternalId: docExternalId,
      });
    }

    for (const chunk of version.chunks) {
      const chunkExternalId = `chunk:${chunk.id}`;
      addNode({
        externalId: chunkExternalId,
        nodeType: "CHUNK",
        label: chunk.title,
        summary: truncate(chunk.content, 160),
        metadata: undefined,
      });
      edges.push({
        edgeType: "VERSION_HAS_CHUNK",
        fromExternalId: versionExternalId,
        toExternalId: chunkExternalId,
      });

      if (chunk.sourceDocumentId) {
        const docExternalId = `source-document:${chunk.sourceDocumentId}`;
        if (nodesByExternalId.has(docExternalId)) {
          edges.push({
            edgeType: "SOURCE_DOCUMENT_HAS_CHUNK",
            fromExternalId: docExternalId,
            toExternalId: chunkExternalId,
          });
          edges.push({
            edgeType: "CHUNK_REFERENCES_SOURCE_DOCUMENT",
            fromExternalId: chunkExternalId,
            toExternalId: docExternalId,
          });
        }
      }

      for (const rawTag of chunk.tags) {
        const normalizedTag = normalizeGraphToken(rawTag);
        if (!normalizedTag) continue;
        const tagExternalId = `tag:${normalizedTag}`;
        addNode({
          externalId: tagExternalId,
          nodeType: "TAG",
          label: normalizedTag,
          summary: null,
          metadata: undefined,
        });
        edges.push({
          edgeType: "CHUNK_HAS_TAG",
          fromExternalId: chunkExternalId,
          toExternalId: tagExternalId,
        });
      }

      // metadata는 허용 canonical key + string/string[] 값만 graph에 반영한다. (민감 key 제외)
      const metadataResult = validateAndNormalizeChunkMetadata(chunk.metadata);
      if (metadataResult.ok && metadataResult.metadata) {
        for (const [key, value] of Object.entries(metadataResult.metadata)) {
          const values = Array.isArray(value) ? value : [value];
          for (const single of values) {
            const normalizedValue = normalizeGraphToken(single);
            if (!normalizedValue) continue;
            const metaExternalId = `metadata:${key}:${normalizedValue}`;
            addNode({
              externalId: metaExternalId,
              nodeType: "METADATA_VALUE",
              label: `${key}: ${single}`,
              summary: null,
              metadata: { key, value: single },
            });
            edges.push({
              edgeType: "CHUNK_HAS_METADATA",
              fromExternalId: chunkExternalId,
              toExternalId: metaExternalId,
            });
          }
        }
      }
    }
  }

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
