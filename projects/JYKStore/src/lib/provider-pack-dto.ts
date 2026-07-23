import type { KnowledgePack, KnowledgePackVersion, PackStatus, SourceDocument } from "@prisma/client";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import type { ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";
import type { PackLanguageCode } from "@/lib/pack-language";
import { toPackLanguageCode } from "@/lib/pack-language";
import type {
  ProviderPackProgressAction,
  ProviderPackCurrentStep,
} from "@/lib/provider-pack-progress";

export type ProviderPackListProgressDto = {
  currentStep: ProviderPackCurrentStep;
  currentStepLabel: string;
  nextActionLabel: string;
  nextActionHref: string | null;
  publishedVersion: string | null;
  workingVersion: string | null;
  actions: ProviderPackProgressAction[];
};

export type ProviderPackListItemDto = {
  packId: string;
  name: string;
  categoryId: string;
  status: PackStatus;
  shortDescription: string;
  icon: string;
  updatedAt: string;
  /** Additive pack-scoped progress for Provider Center cards. */
  progress?: ProviderPackListProgressDto;
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
  /** Provider-selected document language; null until chosen. */
  language: PackLanguageCode | null;
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
  retrievalEvaluation: RetrievalEvaluationSummaryDto | null;
  releaseGate: ReleaseGateSummaryDto | null;
  /** Latest REJECT decision reason when pack was returned for fixes. */
  latestRejectionReason: string | null;
  /**
   * Whether the provider has acknowledged the latest rejection.
   * When false (and a rejection reason exists), content editing stays locked.
   */
  latestRejectionAcknowledged: boolean;
  /** Latest open PackReview.status — PENDING allows withdraw, IN_REVIEW does not. */
  latestReviewStatus: string | null;
  /**
   * Admin ZIP 접수 hold while pack may still be DRAFT.
   * ACCEPTED = 접수완료, PROCESSING = 생성 실행 중,
   * COMPLETED = 생성 완료·관리자 품질검토 중 (검수 요청/반려 전).
   * null = no hold.
   */
  adminGenerationHold: "ACCEPTED" | "PROCESSING" | "COMPLETED" | null;
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
    language: toPackLanguageCode(version.language),
    sourceDocuments: version.sourceDocuments.map((doc) =>
      mapSourceDocument(doc, overlays?.[doc.id]),
    ),
  };
}

export function toProviderPackListItem(
  pack: KnowledgePack,
  progress?: ProviderPackListProgressDto,
): ProviderPackListItemDto {
  return {
    packId: pack.packId,
    name: pack.name,
    categoryId: pack.categoryId,
    status: pack.status,
    shortDescription: pack.shortDescription,
    icon: pack.icon,
    updatedAt: pack.updatedAt.toISOString(),
    ...(progress ? { progress } : {}),
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
    retrievalEvaluation?: RetrievalEvaluationSummaryDto | null;
    releaseGate?: ReleaseGateSummaryDto | null;
    latestRejectionReason?: string | null;
    latestRejectionAcknowledged?: boolean;
    latestReviewStatus?: string | null;
    adminGenerationHold?: "ACCEPTED" | "PROCESSING" | "COMPLETED" | null;
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
    retrievalEvaluation: options?.retrievalEvaluation ?? null,
    releaseGate: options?.releaseGate ?? null,
    latestRejectionReason: options?.latestRejectionReason ?? null,
    latestRejectionAcknowledged: options?.latestRejectionAcknowledged ?? true,
    latestReviewStatus: options?.latestReviewStatus ?? null,
    adminGenerationHold: options?.adminGenerationHold ?? null,
    versions: pack.versions.map((v) => mapVersion(v, validationOverlays)),
    updatedAt: pack.updatedAt.toISOString(),
  };
}
