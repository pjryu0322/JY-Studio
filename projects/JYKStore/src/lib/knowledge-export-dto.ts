import type {
  KnowledgeGraphEdgeDto,
  KnowledgeGraphNodeDto,
  KnowledgeGraphSummaryDto,
} from "@/lib/knowledge-graph-dto";

export const EXPORT_VERSION = "p15.0";

export type PackageExportManifest = {
  name: string;
  knowledgePackId: string;
  version: string | null;
  capabilities: string[];
};

export type PackageExportPack = {
  packId: string;
  name: string;
  category: string;
  providerName: string;
  status: string;
  shortDescription: string;
  description: string;
  tags: string[];
};

export type PackageExportVersion = {
  id: string;
  version: string;
  overview: string;
  versionSummary: string;
  features: string[];
  includedKnowledge: string[];
  supportedEnvironments: string[];
  targetUsers: string[];
  useCases: string[];
} | null;

export type PackageExportSourceDocument = {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
};

export type PackageExportChunk = {
  id: string;
  chunkType: string;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  sortOrder: number;
  sourceDocumentId: string | null;
};

export type PackageExportDto = {
  exportType: "JYKSTORE_PACKAGE_JSON";
  exportVersion: string;
  generatedAt: string;
  manifest: PackageExportManifest;
  pack: PackageExportPack;
  version: PackageExportVersion;
  sourceDocuments: PackageExportSourceDocument[];
  chunks: PackageExportChunk[];
  graph: {
    summary: KnowledgeGraphSummaryDto | null;
    nodes: KnowledgeGraphNodeDto[];
    edges: KnowledgeGraphEdgeDto[];
  };
  embedding: {
    provider: string;
    model: string;
    dimension: number;
    includeVectors: false;
  };
};

export type GraphExportDto = {
  exportType: "JYKSTORE_GRAPH_JSON";
  exportVersion: string;
  generatedAt: string;
  knowledgePackId: string;
  summary: KnowledgeGraphSummaryDto;
  nodes: KnowledgeGraphNodeDto[];
  edges: KnowledgeGraphEdgeDto[];
};

export type McpReadyManifestTool = {
  name: string;
  description: string;
  method: string;
  path: string;
  auth: string;
};

export type McpReadyManifestResource = {
  name: string;
  path: string;
  auth: string;
};

export type McpReadyManifestDto = {
  manifestType: "JYKSTORE_MCP_READY_MANIFEST";
  manifestVersion: string;
  knowledgePackId: string;
  baseUrlPlaceholder: string;
  note: string;
  /** Additive: false when Context/Retrieval are not READY for MCP. */
  supported?: boolean;
  unsupportedReason?: string | null;
  tools: McpReadyManifestTool[];
  resources: McpReadyManifestResource[];
};
