import type { KnowledgeChunk, KnowledgePack, KnowledgePackVersion, SourceDocument } from "@prisma/client";
import {
  readDraftMetadata,
  toProviderKnowledgeUnitDraftSourceDocumentDto,
  type ProviderKnowledgeUnitDraftEvidenceDto,
} from "@/lib/provider-knowledge-unit-draft-dto";

export type AdminKnowledgeUnitDraftSourceDocumentDto = {
  id: string;
  title: string;
  sourceType: string;
  sourceFormat: string;
  sourceUrl: string | null;
  fileName: string | null;
  validationStatus: string;
  validationSummary: string | null;
};

export type AdminKnowledgeUnitDraftDto = {
  id: string;
  packId: string;
  packName: string;
  providerName: string;
  versionId: string;
  sourceDocumentId: string | null;
  title: string;
  content: string;
  section: string | null;
  tags: string[];
  sortOrder: number;
  isActive: false;
  reviewStatus: string;
  reviewDecision: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewMemo: string | null;
  rejectionReason: string | null;
  approvedForActivation: boolean | null;
  activationStatus: string | null;
  activatedChunkId: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  generatedBy: string | null;
  generatedAt: string | null;
  sourcePath: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceFormat: string | null;
  productProfileType: string | null;
  evidence: ProviderKnowledgeUnitDraftEvidenceDto | null;
  sourceDocument: AdminKnowledgeUnitDraftSourceDocumentDto | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminKnowledgeUnitDraftListResponse = {
  clientId: string;
  summary: {
    totalCount: number;
    pendingReviewCount: number;
    approvedCount: number;
    rejectedCount: number;
    supersededCount: number;
    activeDraftCount: number;
  };
  items: AdminKnowledgeUnitDraftDto[];
};

export type AdminKnowledgeUnitDraftDecisionResponse = {
  clientId: string;
  draft: AdminKnowledgeUnitDraftDto;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readAdminDraftReviewFields(metadata: KnowledgeChunk["metadata"]): {
  reviewDecision: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewMemo: string | null;
  rejectionReason: string | null;
  approvedForActivation: boolean | null;
} {
  if (metadata === null || metadata === undefined || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      reviewDecision: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewMemo: null,
      rejectionReason: null,
      approvedForActivation: null,
    };
  }
  const obj = metadata as Record<string, unknown>;
  return {
    reviewDecision: readString(obj.reviewDecision),
    reviewedBy: readString(obj.reviewedBy),
    reviewedAt: readString(obj.reviewedAt),
    reviewMemo: readString(obj.reviewMemo),
    rejectionReason: readString(obj.rejectionReason),
    approvedForActivation: obj.approvedForActivation === true ? true : null,
  };
}

export function readAdminDraftActivationFields(metadata: KnowledgeChunk["metadata"]): {
  activationStatus: string | null;
  activatedChunkId: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  approvedForActivation: boolean | null;
} {
  if (metadata === null || metadata === undefined || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      activationStatus: null,
      activatedChunkId: null,
      activatedBy: null,
      activatedAt: null,
      approvedForActivation: null,
    };
  }
  const obj = metadata as Record<string, unknown>;
  return {
    activationStatus: readString(obj.activationStatus),
    activatedChunkId: readString(obj.activatedChunkId),
    activatedBy: readString(obj.activatedBy),
    activatedAt: readString(obj.activatedAt),
    approvedForActivation: obj.approvedForActivation === true ? true : null,
  };
}

export type AdminKnowledgeUnitDraftChunkRow = KnowledgeChunk & {
  sourceDocument: SourceDocument | null;
  version: KnowledgePackVersion & { pack: KnowledgePack };
};

export function toAdminKnowledgeUnitDraftDto(chunk: AdminKnowledgeUnitDraftChunkRow): AdminKnowledgeUnitDraftDto {
  const meta = readDraftMetadata(chunk.metadata);
  const review = readAdminDraftReviewFields(chunk.metadata);
  const activation = readAdminDraftActivationFields(chunk.metadata);
  const pack = chunk.version.pack;

  return {
    id: chunk.id,
    packId: pack.packId,
    packName: pack.name,
    providerName: pack.providerName,
    versionId: chunk.versionId,
    sourceDocumentId: chunk.sourceDocumentId,
    title: chunk.title,
    content: chunk.content,
    section: chunk.section,
    tags: chunk.tags,
    sortOrder: chunk.sortOrder,
    isActive: false,
    reviewStatus: meta.reviewStatus,
    reviewDecision: review.reviewDecision,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt,
    reviewMemo: review.reviewMemo,
    rejectionReason: review.rejectionReason,
    approvedForActivation: review.approvedForActivation ?? activation.approvedForActivation,
    activationStatus: activation.activationStatus,
    activatedChunkId: activation.activatedChunkId,
    activatedBy: activation.activatedBy ?? review.reviewedBy,
    activatedAt: activation.activatedAt ?? review.reviewedAt,
    generatedBy: meta.generatedBy,
    generatedAt: meta.generatedAt,
    sourcePath: meta.sourcePath,
    sourceUrl: meta.sourceUrl ?? chunk.sourceDocument?.sourceUrl ?? null,
    sourceType: meta.sourceType ?? chunk.sourceDocument?.sourceType ?? null,
    sourceFormat: meta.sourceFormat ?? chunk.sourceDocument?.sourceFormat ?? null,
    productProfileType: meta.productProfileType,
    evidence: meta.evidence,
    sourceDocument: toProviderKnowledgeUnitDraftSourceDocumentDto(chunk.sourceDocument),
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}
