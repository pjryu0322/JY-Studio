export type KnowledgeGraphNodeType =
  | "PACK"
  | "VERSION"
  | "SOURCE_DOCUMENT"
  | "CHUNK"
  | "TAG"
  | "METADATA_VALUE";

export type KnowledgeGraphEdgeType =
  | "PACK_HAS_VERSION"
  | "VERSION_HAS_SOURCE_DOCUMENT"
  | "VERSION_HAS_CHUNK"
  | "SOURCE_DOCUMENT_HAS_CHUNK"
  | "CHUNK_HAS_TAG"
  | "CHUNK_HAS_METADATA"
  | "CHUNK_REFERENCES_SOURCE_DOCUMENT";

export const GRAPH_NODE_TYPES: KnowledgeGraphNodeType[] = [
  "PACK",
  "VERSION",
  "SOURCE_DOCUMENT",
  "CHUNK",
  "TAG",
  "METADATA_VALUE",
];

export const GRAPH_EDGE_TYPES: KnowledgeGraphEdgeType[] = [
  "PACK_HAS_VERSION",
  "VERSION_HAS_SOURCE_DOCUMENT",
  "VERSION_HAS_CHUNK",
  "SOURCE_DOCUMENT_HAS_CHUNK",
  "CHUNK_HAS_TAG",
  "CHUNK_HAS_METADATA",
  "CHUNK_REFERENCES_SOURCE_DOCUMENT",
];

export const GRAPH_SOURCE_AUTO = "AUTO_DETERMINISTIC";

export const GRAPH_QUERY_DEFAULT_LIMIT = 50;
export const GRAPH_QUERY_MIN_LIMIT = 1;
export const GRAPH_QUERY_MAX_LIMIT = 200;

export type KnowledgeGraphNodeDto = {
  id: string;
  packId: string;
  versionId: string | null;
  nodeType: string;
  externalId: string;
  label: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
};

export type KnowledgeGraphEdgeDto = {
  id: string;
  packId: string;
  versionId: string | null;
  edgeType: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  metadata: Record<string, unknown> | null;
};

export type KnowledgeGraphSummaryDto = {
  packId: string;
  versionId: string | null;
  nodeCount: number;
  edgeCount: number;
  nodeTypeCounts: Record<string, number>;
  edgeTypeCounts: Record<string, number>;
};

export type KnowledgeGraphRebuildResultDto = {
  packId: string;
  versionId: string | null;
  nodeCount: number;
  edgeCount: number;
  deletedNodeCount: number;
  deletedEdgeCount: number;
};

export type KnowledgeGraphQueryRequestBody = {
  knowledgePackId?: string;
  query?: string;
  nodeTypes?: string[];
  edgeTypes?: string[];
  limit?: number;
  includeEdges?: boolean;
};

export type KnowledgeGraphQueryResponseDto = {
  nodes: KnowledgeGraphNodeDto[];
  edges: KnowledgeGraphEdgeDto[];
  usage: {
    requestId: string;
    nodeCount: number;
    edgeCount: number;
    limit: number;
  };
};

export function normalizeGraphToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}
