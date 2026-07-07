import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@prisma/client";
import type {
  KnowledgeGraphEdgeDto,
  KnowledgeGraphNodeDto,
} from "@/lib/knowledge-graph-dto";

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function toNodeDto(node: KnowledgeGraphNode): KnowledgeGraphNodeDto {
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

export function toEdgeDto(edge: KnowledgeGraphEdge): KnowledgeGraphEdgeDto {
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
