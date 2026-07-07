import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embedding-dto";
import {
  EXPORT_VERSION,
  type PackageExportChunk,
  type PackageExportDto,
} from "@/lib/knowledge-export-dto";
import { exportKnowledgeGraph } from "@/lib/knowledge-graph/graph-export-service";
import {
  buildExportGeneratedAt,
  loadLatestPackVersion,
  loadPublicKnowledgePack,
  sanitizeExportMetadata,
} from "./export-shared";

export async function buildPackageExport(packId: string): Promise<PackageExportDto | null> {
  const pack = await loadPublicKnowledgePack(packId, {
    packId: true,
    name: true,
    categoryId: true,
    providerName: true,
    status: true,
    shortDescription: true,
    description: true,
    tags: true,
  });
  if (!pack) return null;

  const version = await loadLatestPackVersion(packId);
  const graph = await exportKnowledgeGraph(packId);

  const chunks: PackageExportChunk[] = (version?.chunks ?? []).map((chunk) => ({
    id: chunk.id,
    chunkType: chunk.chunkType,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    metadata: sanitizeExportMetadata(chunk.metadata),
    sortOrder: chunk.sortOrder,
    sourceDocumentId: chunk.sourceDocumentId,
  }));

  return {
    exportType: "JYKSTORE_PACKAGE_JSON",
    exportVersion: EXPORT_VERSION,
    generatedAt: buildExportGeneratedAt(),
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
