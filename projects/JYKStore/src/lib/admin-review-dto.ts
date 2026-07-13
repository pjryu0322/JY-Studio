import type { KnowledgePack, KnowledgePackVersion, PackReview, SourceDocument } from "@prisma/client";
import type { SourceValidationReportDto } from "@/lib/source-validation-dto";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import type { ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";
import {
  getReleaseGateApprovalMessage,
  meetsReleaseGateForApproval,
} from "@/lib/release-gate/release-gate-readiness";
import { parseProviderReviewSubmitSnapshot } from "@/lib/provider-review-submit-snapshot";
import {
  chunkQualityGateSnapshotFromSummary,
  getChunkQualityBlockingMessage,
  meetsChunkQualityGate,
} from "@/lib/chunk-quality/chunk-quality-readiness";
import {
  canApproveReviewReadiness,
  countSourceValidationFromStatuses,
} from "@/lib/source-validation-readiness";
import {
  getStructureQualityBlockingMessage,
  meetsStructureQualityGate,
  structureQualityGateSnapshotFromSummary,
} from "@/lib/structure-quality/structure-quality-readiness";
import {
  getRetrievalEvaluationBlockingMessage,
  meetsRetrievalEvaluationGate,
  retrievalEvaluationGateSnapshotFromSummary,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";

export type AdminReviewListItemDto = {
  packId: string;
  name: string;
  providerName: string;
  categoryId: string;
  status: string;
  /** Latest PackReview.status (PENDING = 접수 대기, IN_REVIEW = 검수 중). */
  reviewStatus: string | null;
  shortDescription: string;
  submittedAt: string | null;
  updatedAt: string;
  versionCount: number;
  sourceDocumentCount: number;
};

export type AdminReviewDetailDto = {
  pack: {
    packId: string;
    name: string;
    providerName: string;
    providerType: string;
    categoryId: string;
    status: string;
    pricing: string;
    icon: string;
    shortDescription: string;
    description: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  versions: {
    id: string;
    version: string;
    overview: string;
    features: string[];
    includedKnowledge: string[];
    supportedEnvironments: string[];
    targetUsers: string[];
    useCases: string[];
    versionSummary: string;
    sourceDocuments: {
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
      contentPreview: string | null;
      createdAt: string;
    }[];
  }[];
  latestReview: {
    id: string;
    status: string;
    decision: string | null;
    memo: string | null;
    rejectionReason: string | null;
    reviewerUserId: string | null;
    createdAt: string;
    updatedAt: string;
    decidedAt: string | null;
    submitSnapshot: import("@/lib/provider-review-submit-snapshot").AnyReviewSubmitSnapshot | null;
  } | null;
  payload: {
    id: string;
    profile: string;
    generatorType: string;
    generatorVersion: string | null;
    originalFileName: string;
    fileSize: number;
    checksumSha256: string;
    validationStatus: string;
    validationMessage: string | null;
    validationReport: unknown;
    manifest: unknown;
    uploadedAt: string;
  } | null;
  /** Current DB-derived distribution fingerprint for drift checks (schema 0.2). */
  currentManifestFingerprint: string | null;
  /** Precomputed Docling review integrity (DOCLING_BUNDLE only). */
  doclingReviewIntegrity: {
    status: "PASS" | "BLOCKED" | "UNKNOWN";
    errors: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
  } | null;
  distribution: {
    sourceTitle: string | null;
    sourceUrl: string | null;
    licenseName: string;
    licenseUrl: string | null;
    usageTerms: string | null;
    readmeText: string | null;
    visibility: string;
    allowDownload: boolean;
  } | null;
  readiness: {
    versionCount: number;
    sourceDocumentCount: number;
    hasRequiredDescription: boolean;
    canApprove: boolean;
    pipelineStatus: string;
    sourceValidation: {
      passCount: number;
      warningCount: number;
      failCount: number;
      notCheckedCount: number;
    };
    sourceTypeCoverage: Record<string, number>;
    structureCoverageStatus: string | null;
    knowledgeQualityStatus: string | null;
    structureQualityMessage: string | null;
    chunkQualityStatus: string | null;
    chunkQualityMessage: string | null;
    retrievalEvaluationStatus: string | null;
    retrievalEvaluationMessage: string | null;
    releaseGateStatus: string | null;
    releaseGateMessage: string | null;
  };
  structureQuality: StructureQualitySummaryDto | null;
  chunkQuality: ChunkQualitySummaryDto | null;
  retrievalEvaluation: RetrievalEvaluationSummaryDto | null;
  releaseGate: ReleaseGateSummaryDto | null;
};

const CONTENT_PREVIEW_MAX = 800;

export function truncateContentPreview(content: string | null | undefined): string | null {
  if (!content?.trim()) return null;
  const trimmed = content.trim();
  if (trimmed.length <= CONTENT_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, CONTENT_PREVIEW_MAX)}…`;
}

type PackWithDetail = KnowledgePack & {
  versions: (KnowledgePackVersion & { sourceDocuments: SourceDocument[] })[];
  reviews: PackReview[];
};

function computeReadiness(pack: PackWithDetail) {
  const docs = pack.versions.flatMap((v) => v.sourceDocuments);
  const versionCount = pack.versions.length;
  const sourceDocumentCount = docs.length;
  const hasRequiredDescription =
    Boolean(pack.shortDescription.trim()) && Boolean(pack.description.trim());

  const sourceValidation = countSourceValidationFromStatuses(
    docs.map((d) => d.validationStatus),
  );

  const sourceTypeCoverage: Record<string, number> = {};
  for (const doc of docs) {
    sourceTypeCoverage[doc.sourceType] = (sourceTypeCoverage[doc.sourceType] ?? 0) + 1;
  }

  const canApprove = canApproveReviewReadiness(
    {
      isReviewing: pack.status === "REVIEWING",
      versionCount,
      sourceDocumentCount,
      hasRequiredDescription,
    },
    sourceValidation,
  );

  return {
    versionCount,
    sourceDocumentCount,
    hasRequiredDescription,
    canApprove,
    pipelineStatus: pack.pipelineStatus,
    sourceValidation,
    sourceTypeCoverage,
    structureCoverageStatus: null,
    knowledgeQualityStatus: null,
    structureQualityMessage: null,
    chunkQualityStatus: null,
    chunkQualityMessage: null,
    retrievalEvaluationStatus: null,
    retrievalEvaluationMessage: null,
    releaseGateStatus: null,
    releaseGateMessage: null,
  };
}

export function toAdminReviewListItem(
  pack: KnowledgePack & {
    versions: { sourceDocuments: unknown[] }[];
    reviews: { createdAt: Date; status: string }[];
  },
): AdminReviewListItemDto {
  const versionCount = pack.versions.length;
  const sourceDocumentCount = pack.versions.reduce(
    (sum, v) => sum + v.sourceDocuments.length,
    0,
  );
  const latestReview = pack.reviews[0];
  const submittedAt = latestReview?.createdAt.toISOString() ?? pack.updatedAt.toISOString();

  return {
    packId: pack.packId,
    name: pack.name,
    providerName: pack.providerName,
    categoryId: pack.categoryId,
    status: pack.status,
    reviewStatus: latestReview?.status ?? null,
    shortDescription: pack.shortDescription,
    submittedAt,
    updatedAt: pack.updatedAt.toISOString(),
    versionCount,
    sourceDocumentCount,
  };
}

export function toAdminReviewDetail(pack: PackWithDetail): AdminReviewDetailDto {
  const readiness = computeReadiness(pack);
  const latest = pack.reviews[0];

  return {
    pack: {
      packId: pack.packId,
      name: pack.name,
      providerName: pack.providerName,
      providerType: pack.providerType,
      categoryId: pack.categoryId,
      status: pack.status,
      pricing: pack.pricing,
      icon: pack.icon,
      shortDescription: pack.shortDescription,
      description: pack.description,
      tags: pack.tags,
      createdAt: pack.createdAt.toISOString(),
      updatedAt: pack.updatedAt.toISOString(),
    },
    versions: pack.versions.map((version) => ({
      id: version.id,
      version: version.version,
      overview: version.overview,
      features: version.features,
      includedKnowledge: version.includedKnowledge,
      supportedEnvironments: version.supportedEnvironments,
      targetUsers: version.targetUsers,
      useCases: version.useCases,
      versionSummary: version.versionSummary,
      sourceDocuments: version.sourceDocuments.map((doc) => ({
        id: doc.id,
        title: doc.title,
        sourceType: doc.sourceType,
        sourceFormat: doc.sourceFormat,
        sourceUrl: doc.sourceUrl,
        productVersion: doc.productVersion,
        documentVersion: doc.documentVersion,
        validationStatus: doc.validationStatus,
        validationSummary: doc.validationSummary,
        validationScore: null,
        blockingIssueCount: 0,
        warningIssueCount: 0,
        validationIssues: [],
        contentPreview: truncateContentPreview(doc.content),
        createdAt: doc.createdAt.toISOString(),
      })),
    })),
    latestReview: latest
      ? {
          id: latest.id,
          status: latest.status,
          decision: latest.decision,
          memo: latest.memo,
          rejectionReason: latest.rejectionReason,
          reviewerUserId: latest.reviewerUserId ?? null,
          createdAt: latest.createdAt.toISOString(),
          updatedAt: latest.updatedAt.toISOString(),
          decidedAt: latest.decidedAt?.toISOString() ?? null,
          submitSnapshot: parseProviderReviewSubmitSnapshot(
            (latest as { submitSnapshot?: unknown }).submitSnapshot,
          ),
        }
      : null,
    readiness,
    payload: null,
    currentManifestFingerprint: null,
    doclingReviewIntegrity: null,
    distribution: null,
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    releaseGate: null,
  };
}

export function applyDistributionFieldsToAdminDetail(
  detail: AdminReviewDetailDto,
  input: {
    payload: AdminReviewDetailDto["payload"];
    distribution: AdminReviewDetailDto["distribution"];
    currentManifestFingerprint?: string | null;
  },
): AdminReviewDetailDto {
  const isDistribution = Boolean(input.payload);
  return {
    ...detail,
    payload: input.payload,
    currentManifestFingerprint: input.currentManifestFingerprint ?? null,
    distribution: input.distribution,
    readiness: {
      ...detail.readiness,
      // Distribution packs do not rely on legacy source/chunk gates.
      canApprove: isDistribution
        ? detail.pack.status === "REVIEWING" &&
          Boolean(input.payload) &&
          input.payload?.validationStatus === "VALID" &&
          Boolean(input.distribution?.licenseName.trim())
        : detail.readiness.canApprove,
    },
  };
}

export function applyStructureQualityToAdminDetail(
  detail: AdminReviewDetailDto,
  structureQuality: StructureQualitySummaryDto | null,
): AdminReviewDetailDto {
  const snapshot = structureQualityGateSnapshotFromSummary(structureQuality);
  const gateOk = meetsStructureQualityGate(snapshot);
  const structureQualityMessage = getStructureQualityBlockingMessage(snapshot, structureQuality);

  return {
    ...detail,
    structureQuality,
    readiness: {
      ...detail.readiness,
      canApprove: detail.readiness.canApprove && gateOk,
      structureCoverageStatus: snapshot.structureCoverageStatus,
      knowledgeQualityStatus: snapshot.knowledgeQualityStatus,
      structureQualityMessage,
    },
  };
}

export function applyChunkQualityToAdminDetail(
  detail: AdminReviewDetailDto,
  chunkQuality: ChunkQualitySummaryDto | null,
): AdminReviewDetailDto {
  const snapshot = chunkQualityGateSnapshotFromSummary(chunkQuality);
  const gateOk = meetsChunkQualityGate(snapshot);
  const chunkQualityMessage = getChunkQualityBlockingMessage(snapshot, chunkQuality);

  return {
    ...detail,
    chunkQuality,
    readiness: {
      ...detail.readiness,
      canApprove: detail.readiness.canApprove && gateOk,
      chunkQualityStatus: snapshot.reportStatus,
      chunkQualityMessage,
    },
  };
}

export function applyRetrievalEvaluationToAdminDetail(
  detail: AdminReviewDetailDto,
  retrievalEvaluation: RetrievalEvaluationSummaryDto | null,
): AdminReviewDetailDto {
  const snapshot = retrievalEvaluationGateSnapshotFromSummary(retrievalEvaluation);
  const gateOk = meetsRetrievalEvaluationGate(snapshot);
  const retrievalEvaluationMessage = getRetrievalEvaluationBlockingMessage(
    snapshot,
    retrievalEvaluation,
  );

  return {
    ...detail,
    retrievalEvaluation,
    readiness: {
      ...detail.readiness,
      canApprove: detail.readiness.canApprove && gateOk,
      retrievalEvaluationStatus: snapshot.reportStatus,
      retrievalEvaluationMessage,
    },
  };
}

export function applyReleaseGateToAdminDetail(
  detail: AdminReviewDetailDto,
  releaseGate: ReleaseGateSummaryDto | null,
): AdminReviewDetailDto {
  const gateOk = meetsReleaseGateForApproval(releaseGate);
  const releaseGateMessage = getReleaseGateApprovalMessage(releaseGate);
  const releaseGateStatus = releaseGate?.latestRun?.status ?? null;

  return {
    ...detail,
    releaseGate,
    readiness: {
      ...detail.readiness,
      canApprove: detail.readiness.canApprove && gateOk,
      releaseGateStatus,
      releaseGateMessage,
    },
  };
}

export function enrichAdminReviewDetailWithValidationReports(
  detail: AdminReviewDetailDto,
  reports: Record<string, SourceValidationReportDto>,
): AdminReviewDetailDto {
  return {
    ...detail,
    versions: detail.versions.map((version) => ({
      ...version,
      sourceDocuments: version.sourceDocuments.map((doc) => {
        const report = reports[doc.id];
        return {
          ...doc,
          validationScore: report?.score ?? doc.validationScore,
          blockingIssueCount: report?.blockingIssueCount ?? doc.blockingIssueCount,
          warningIssueCount: report?.warningIssueCount ?? doc.warningIssueCount,
          validationIssues:
            report?.issues.map((issue) => ({
              severity: issue.severity,
              code: issue.code,
              message: issue.message,
              field: issue.field,
              hint: issue.hint,
            })) ?? doc.validationIssues,
        };
      }),
    })),
  };
}
