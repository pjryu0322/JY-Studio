import type { KnowledgePack, KnowledgePackVersion, PackStatus, SourceDocument } from "@prisma/client";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";

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
  sourceFormat: string;
  sourceUrl: string | null;
  productVersion: string | null;
  documentVersion: string | null;
  validationStatus: string;
  validationSummary: string | null;
  validationScore: number | null;
  blockingIssueCount: number;
  warningIssueCount: number;
  validationIssues: {
    severity: string;
    code: string;
    message: string;
    field: string | null;
    hint: string | null;
  }[];
  createdAt: string;
};

export type ProviderSourceDocumentValidationOverlay = {
  validationScore: number | null;
  blockingIssueCount: number;
  warningIssueCount: number;
  validationIssues: ProviderSourceDocumentDto["validationIssues"];
};

function mapSourceDocument(
  doc: SourceDocument,
  overlay?: ProviderSourceDocumentValidationOverlay,
): ProviderSourceDocumentDto {
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
    sourceFormat: doc.sourceFormat,
    sourceUrl: doc.sourceUrl,
    productVersion: doc.productVersion,
    documentVersion: doc.documentVersion,
    validationStatus: doc.validationStatus,
    validationSummary: doc.validationSummary,
    validationScore: overlay?.validationScore ?? null,
    blockingIssueCount: overlay?.blockingIssueCount ?? 0,
    warningIssueCount: overlay?.warningIssueCount ?? 0,
    validationIssues: overlay?.validationIssues ?? [],
    createdAt: doc.createdAt.toISOString(),
  };
}

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
  pipelineStatus: string;
  pipelineUpdatedAt: string | null;
  shortDescription: string;
  description: string;
  tags: string[];
  icon: string;
  pricing: string;
  providerName: string;
  structureTemplateKey: string | null;
  structureQuality: StructureQualitySummaryDto | null;
  chunkQuality: ChunkQualitySummaryDto | null;
  versions: ProviderPackVersionDto[];
  updatedAt: string;
};

function mapVersion(
  version: KnowledgePackVersion & { sourceDocuments: SourceDocument[] },
  overlays?: Record<string, ProviderSourceDocumentValidationOverlay>,
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
    sourceDocuments: version.sourceDocuments.map((doc) =>
      mapSourceDocument(doc, overlays?.[doc.id]),
    ),
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
  validationOverlays?: Record<string, ProviderSourceDocumentValidationOverlay>,
  options?: {
    structureTemplateKey?: string | null;
    structureQuality?: StructureQualitySummaryDto | null;
    chunkQuality?: ChunkQualitySummaryDto | null;
  },
): ProviderPackDetailDto {
  return {
    packId: pack.packId,
    name: pack.name,
    categoryId: pack.categoryId,
    status: pack.status,
    pipelineStatus: pack.pipelineStatus,
    pipelineUpdatedAt: pack.pipelineUpdatedAt?.toISOString() ?? null,
    shortDescription: pack.shortDescription,
    description: pack.description,
    tags: pack.tags,
    icon: pack.icon,
    pricing: pack.pricing,
    providerName: pack.providerName,
    structureTemplateKey: options?.structureTemplateKey ?? pack.structureTemplateKey ?? null,
    structureQuality: options?.structureQuality ?? null,
    chunkQuality: options?.chunkQuality ?? null,
    versions: pack.versions.map((v) => mapVersion(v, validationOverlays)),
    updatedAt: pack.updatedAt.toISOString(),
  };
}
