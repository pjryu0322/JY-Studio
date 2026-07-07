import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import { exportKnowledgeGraph } from "@/lib/knowledge-graph-service";
import {
  EXPORT_VERSION,
  type GraphExportDto,
  type McpReadyManifestDto,
  type PackageExportChunk,
  type PackageExportDto,
} from "@/lib/knowledge-export-dto";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";

function safeMetadata(raw: unknown): Record<string, unknown> | null {
  // 저장된 metadata를 canonical/민감 key 제거 후에만 export한다.
  const result = validateAndNormalizeChunkMetadata(raw);
  if (result.ok && result.metadata) {
    return result.metadata as Record<string, unknown>;
  }
  return null;
}

async function loadLatestVersion(packId: string) {
  return prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    include: {
      sourceDocuments: { orderBy: { createdAt: "asc" } },
      chunks: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function buildPackageExport(packId: string): Promise<PackageExportDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: {
      packId: true,
      name: true,
      categoryId: true,
      providerName: true,
      status: true,
      shortDescription: true,
      description: true,
      tags: true,
    },
  });
  if (!pack) return null;

  const version = await loadLatestVersion(packId);
  const graph = await exportKnowledgeGraph(packId);

  const chunks: PackageExportChunk[] = (version?.chunks ?? []).map((chunk) => ({
    id: chunk.id,
    chunkType: chunk.chunkType,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    metadata: safeMetadata(chunk.metadata),
    sortOrder: chunk.sortOrder,
    sourceDocumentId: chunk.sourceDocumentId,
  }));

  return {
    exportType: "JYKSTORE_PACKAGE_JSON",
    exportVersion: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    manifest: {
      name: "JYKStore Package Export",
      knowledgePackId: pack.packId,
      version: version?.version ?? null,
      capabilities: ["context", "metadata", "graph", "rag-jsonl"],
    },
    pack: {
      packId: pack.packId,
      name: pack.name,
      category: pack.categoryId,
      providerName: pack.providerName,
      status: pack.status,
      shortDescription: pack.shortDescription,
      description: pack.description,
      tags: pack.tags,
    },
    version: version
      ? {
          id: version.id,
          version: version.version,
          overview: version.overview,
          versionSummary: version.versionSummary,
          features: version.features,
          includedKnowledge: version.includedKnowledge,
          supportedEnvironments: version.supportedEnvironments,
          targetUsers: version.targetUsers,
          useCases: version.useCases,
        }
      : null,
    sourceDocuments: (version?.sourceDocuments ?? []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
    })),
    chunks,
    graph: {
      summary: graph?.summary ?? null,
      nodes: graph?.nodes ?? [],
      edges: graph?.edges ?? [],
    },
    embedding: {
      provider: DEFAULT_EMBEDDING_PROVIDER,
      model: DEFAULT_EMBEDDING_MODEL,
      dimension: DEFAULT_EMBEDDING_DIMENSION,
      includeVectors: false,
    },
  };
}

export async function buildRagJsonlExport(packId: string): Promise<string | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true },
  });
  if (!pack) return null;

  const version = await loadLatestVersion(packId);
  if (!version) return "";

  const docTitleById = new Map(version.sourceDocuments.map((doc) => [doc.id, doc.title]));

  const lines = version.chunks.map((chunk) => {
    const references = chunk.sourceDocumentId && docTitleById.has(chunk.sourceDocumentId)
      ? [{ type: "SOURCE_DOCUMENT", title: docTitleById.get(chunk.sourceDocumentId)! }]
      : [];

    const record = {
      id: chunk.id,
      knowledgePackId: pack.packId,
      version: version.version,
      title: chunk.title,
      text: chunk.content,
      metadata: safeMetadata(chunk.metadata) ?? {},
      references,
    };
    return JSON.stringify(record);
  });

  return lines.join("\n");
}

export async function buildGraphExport(packId: string): Promise<GraphExportDto | null> {
  const graph = await exportKnowledgeGraph(packId);
  if (!graph) return null;

  return {
    exportType: "JYKSTORE_GRAPH_JSON",
    exportVersion: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    knowledgePackId: packId,
    summary: graph.summary,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export async function buildMcpReadyManifest(packId: string): Promise<McpReadyManifestDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true },
  });
  if (!pack) return null;

  return {
    manifestType: "JYKSTORE_MCP_READY_MANIFEST",
    manifestVersion: EXPORT_VERSION,
    knowledgePackId: pack.packId,
    baseUrlPlaceholder: "https://your-jykstore.example.com",
    note: "This is a MCP-ready manifest, not a running MCP server. It does not include API keys or answer generation.",
    tools: [
      {
        name: "jykstore.retrieval.query",
        description: "Return context candidates from a JYKStore knowledge pack.",
        method: "POST",
        path: "/api/v1/retrieval/query",
        auth: "Bearer API Key",
      },
      {
        name: "jykstore.graph.query",
        description: "Return graph nodes and edges from a JYKStore knowledge pack.",
        method: "POST",
        path: "/api/v1/graph/query",
        auth: "Bearer API Key",
      },
    ],
    resources: [
      {
        name: "rag-jsonl-export",
        path: `/api/v1/exports/rag-jsonl?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
      {
        name: "graph-json-export",
        path: `/api/v1/exports/graph?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
      {
        name: "package-json-export",
        path: `/api/v1/exports/package?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
    ],
  };
}
