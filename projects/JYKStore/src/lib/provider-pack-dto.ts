import type { KnowledgePack, KnowledgePackVersion, PackStatus, SourceDocument } from "@prisma/client";

export type ProviderPackListItemDto = {
  packId: string;
  name: string;
  categoryId: string;
  status: PackStatus;
  shortDescription: string;
  icon: string;
  updatedAt: string;
};

export type ProviderSourceDocumentDto = {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  createdAt: string;
};

export type ProviderPackVersionDto = {
  id: string;
  version: string;
  overview: string;
  features: string[];
  includedKnowledge: string[];
  supportedEnvironments: string[];
  targetUsers: string[];
  useCases: string[];
  versionSummary: string;
  sourceDocuments: ProviderSourceDocumentDto[];
};

export type ProviderPackDetailDto = {
  packId: string;
  name: string;
  categoryId: string;
  status: PackStatus;
  shortDescription: string;
  description: string;
  tags: string[];
  icon: string;
  pricing: string;
  providerName: string;
  versions: ProviderPackVersionDto[];
  updatedAt: string;
};

function mapSourceDocument(doc: SourceDocument): ProviderSourceDocumentDto {
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    createdAt: doc.createdAt.toISOString(),
  };
}

function mapVersion(
  version: KnowledgePackVersion & { sourceDocuments: SourceDocument[] },
): ProviderPackVersionDto {
  return {
    id: version.id,
    version: version.version,
    overview: version.overview,
    features: version.features,
    includedKnowledge: version.includedKnowledge,
    supportedEnvironments: version.supportedEnvironments,
    targetUsers: version.targetUsers,
    useCases: version.useCases,
    versionSummary: version.versionSummary,
    sourceDocuments: version.sourceDocuments.map(mapSourceDocument),
  };
}

export function toProviderPackListItem(pack: KnowledgePack): ProviderPackListItemDto {
  return {
    packId: pack.packId,
    name: pack.name,
    categoryId: pack.categoryId,
    status: pack.status,
    shortDescription: pack.shortDescription,
    icon: pack.icon,
    updatedAt: pack.updatedAt.toISOString(),
  };
}

export function toProviderPackDetail(
  pack: KnowledgePack & {
    versions: (KnowledgePackVersion & { sourceDocuments: SourceDocument[] })[];
  },
): ProviderPackDetailDto {
  return {
    packId: pack.packId,
    name: pack.name,
    categoryId: pack.categoryId,
    status: pack.status,
    shortDescription: pack.shortDescription,
    description: pack.description,
    tags: pack.tags,
    icon: pack.icon,
    pricing: pack.pricing,
    providerName: pack.providerName,
    versions: pack.versions.map(mapVersion),
    updatedAt: pack.updatedAt.toISOString(),
  };
}
