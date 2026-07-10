import type { Prisma } from "@prisma/client";
import type { KnowledgeChunk, SourceDocument } from "@prisma/client";

export type ProviderKnowledgeUnitDraftEvidenceDto = {
  path?: string | null;
  headings?: string[];
  keywords?: string[];
  excerpt?: string | null;
};

export type ProviderKnowledgeUnitDraftSourceDocumentDto = {
  id: string;
  title: string;
  sourceType: string;
  sourceFormat: string;
  sourceUrl: string | null;
  fileName: string | null;
  validationStatus: string;
  validationSummary: string | null;
};

export type ProviderKnowledgeUnitDraftDto = {
  id: string;
  versionId: string;
  sourceDocumentId: string | null;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  isActive: false;
  reviewStatus: string;
  generatedBy: string | null;
  generatedAt: string | null;
  sourcePath: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceFormat: string | null;
  productProfileType: string | null;
  evidence: ProviderKnowledgeUnitDraftEvidenceDto | null;
  sourceDocument: ProviderKnowledgeUnitDraftSourceDocumentDto | null;
  topic: string | null;
  warnings: string[];
  semanticTopicKey: string | null;
  canonicalSourcePath: string | null;
  duplicateSources: ProviderKnowledgeUnitDraftDuplicateSourceDto[];
  createdAt: string;
  updatedAt: string;
};

export type ProviderKnowledgeUnitDocumentProcessingDto = {
  sourceDocumentId: string;
  path: string;
  title: string;
  status: "generated" | "duplicate" | "excluded" | "unsupported" | "failed";
  reasonCode?: string;
  reason?: string;
  generatedUnitTitles: string[];
  duplicateOfChunkId?: string;
  steps: string[];
};

export type ProviderKnowledgeUnitProcessingSummaryDto = {
  sourceDocumentTotal: number;
  generated: number;
  duplicate: number;
  excluded: number;
  unsupported: number;
  failed: number;
  progressPercent: number;
  generationScope?: string;
  isPreviewGeneration?: boolean;
};

export type ProviderKnowledgeUnitDraftListResponse = {
  clientId: string;
  packId: string;
  versionId: string;
  summary: {
    totalCount: number;
    pendingReviewCount: number;
    supersededCount: number;
    activeDraftCount: number;
  };
  processing: ProviderKnowledgeUnitProcessingSummaryDto;
  documentProcessing: ProviderKnowledgeUnitDocumentProcessingDto[];
  items: ProviderKnowledgeUnitDraftDto[];
};

export type DraftMetadataFields = {
  reviewStatus: string;
  generatedBy: string | null;
  generatedAt: string | null;
  sourcePath: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceFormat: string | null;
  productProfileType: string | null;
  topic: string | null;
  warnings: string[];
  evidence: ProviderKnowledgeUnitDraftEvidenceDto | null;
  semanticTopicKey: string | null;
  canonicalSourcePath: string | null;
  duplicateSources: ProviderKnowledgeUnitDraftDuplicateSourceDto[];
};

export type ProviderKnowledgeUnitDraftDuplicateSourceDto = {
  sourceDocumentId: string;
  sourcePath: string | null;
  title: string;
  reason: string;
};

export type ProviderKnowledgeUnitDraftResetResponse = {
  clientId: string;
  packId: string;
  versionId: string;
  deletedDraftCount: number;
  deletedReportCount: number;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function readDraftMetadata(metadata: Prisma.JsonValue | null): DraftMetadataFields {
  const defaults: DraftMetadataFields = {
    reviewStatus: "unknown",
    generatedBy: null,
    generatedAt: null,
    sourcePath: null,
    sourceUrl: null,
    sourceType: null,
    sourceFormat: null,
    productProfileType: null,
    topic: null,
    warnings: [],
    evidence: null,
    semanticTopicKey: null,
    canonicalSourcePath: null,
    duplicateSources: [],
  };

  if (metadata === null || metadata === undefined) return defaults;
  if (typeof metadata !== "object" || Array.isArray(metadata)) return defaults;

  const obj = metadata as Record<string, unknown>;
  const evidenceRaw = obj.evidence;
  let evidence: ProviderKnowledgeUnitDraftEvidenceDto | null = null;
  if (evidenceRaw && typeof evidenceRaw === "object" && !Array.isArray(evidenceRaw)) {
    const ev = evidenceRaw as Record<string, unknown>;
    evidence = {
      path: readString(ev.path),
      headings: readStringArray(ev.headings),
      keywords: readStringArray(ev.keywords),
      excerpt: readString(ev.excerpt),
    };
  }

  const warnings = readStringArray(obj.warnings) ?? [];

  const duplicateSources: ProviderKnowledgeUnitDraftDuplicateSourceDto[] = [];
  if (Array.isArray(obj.duplicateSources)) {
    for (const entry of obj.duplicateSources) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>;
      const sourceDocumentId = readString(row.sourceDocumentId);
      if (!sourceDocumentId) continue;
      duplicateSources.push({
        sourceDocumentId,
        sourcePath: readString(row.sourcePath),
        title: readString(row.title) ?? "",
        reason: readString(row.reason) ?? "duplicate",
      });
    }
  }

  return {
    reviewStatus: readString(obj.reviewStatus) ?? "unknown",
    generatedBy: readString(obj.generatedBy),
    generatedAt: readString(obj.generatedAt),
    sourcePath: readString(obj.sourcePath),
    sourceUrl: readString(obj.sourceUrl),
    sourceType: readString(obj.sourceType),
    sourceFormat: readString(obj.sourceFormat),
    productProfileType: readString(obj.productProfileType),
    topic: readString(obj.topic),
    warnings,
    evidence,
    semanticTopicKey: readString(obj.semanticTopicKey),
    canonicalSourcePath: readString(obj.canonicalSourcePath),
    duplicateSources,
  };
}

export function toProviderKnowledgeUnitDraftSourceDocumentDto(
  doc: SourceDocument | null,
): ProviderKnowledgeUnitDraftSourceDocumentDto | null {
  if (!doc) return null;
  return {
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
    sourceFormat: doc.sourceFormat,
    sourceUrl: doc.sourceUrl,
    fileName: doc.fileName,
    validationStatus: doc.validationStatus,
    validationSummary: doc.validationSummary,
  };
}

export function toProviderKnowledgeUnitDraftDto(
  chunk: KnowledgeChunk & { sourceDocument: SourceDocument | null },
): ProviderKnowledgeUnitDraftDto {
  const meta = readDraftMetadata(chunk.metadata);
  return {
    id: chunk.id,
    versionId: chunk.versionId,
    sourceDocumentId: chunk.sourceDocumentId,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    sortOrder: chunk.sortOrder,
    isActive: false,
    reviewStatus: meta.reviewStatus,
    generatedBy: meta.generatedBy,
    generatedAt: meta.generatedAt,
    sourcePath: meta.sourcePath,
    sourceUrl: meta.sourceUrl ?? chunk.sourceDocument?.sourceUrl ?? null,
    sourceType: meta.sourceType ?? chunk.sourceDocument?.sourceType ?? null,
    sourceFormat: meta.sourceFormat ?? chunk.sourceDocument?.sourceFormat ?? null,
    productProfileType: meta.productProfileType,
    evidence: meta.evidence,
    sourceDocument: toProviderKnowledgeUnitDraftSourceDocumentDto(chunk.sourceDocument),
    topic: meta.topic,
    warnings: meta.warnings,
    semanticTopicKey: meta.semanticTopicKey,
    canonicalSourcePath: meta.canonicalSourcePath,
    duplicateSources: meta.duplicateSources,
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}
