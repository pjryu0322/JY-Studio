import { AuditAction, PackStatus } from "@prisma/client";
import {
  toAdminReviewDetail,
  toAdminReviewListItem,
  enrichAdminReviewDetailWithValidationReports,
  applyStructureQualityToAdminDetail,
  applyChunkQualityToAdminDetail,
  applyRetrievalEvaluationToAdminDetail,
  applyReleaseGateToAdminDetail,
  applyDistributionFieldsToAdminDetail,
  type AdminReviewDetailDto,
} from "@/lib/admin-review-dto";
import {
  evaluatePackStructureQuality,
} from "@/lib/structure-quality/structure-quality-evaluate-service";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { loadRetrievalEvaluationSummaryForPack } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import { canRunAdminRetrievalEvaluationForStatus } from "@/lib/retrieval-evaluation/retrieval-evaluation-runner";
import { evaluateReleaseGateForPack, loadReleaseGateSummaryForPack } from "@/lib/release-gate/release-gate-service";
import {
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import { batchResolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import {
  assertDoclingReviewIntegrityOrThrow,
  summarizeDoclingReviewIntegrity,
  validateDoclingReviewIntegrity,
} from "@/lib/docling-import/docling-review-integrity-service";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  validateAllSourceDocumentsForPack,
  validateAndPersistSourceDocument,
  loadLatestReportsByDocumentIds,
} from "@/lib/source-validation/source-validation-report-service";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";
import {
  OPEN_PACK_REVIEW_STATUSES,
  PackReviewStatus,
  isOpenPackReviewStatus,
} from "@/lib/pack-review-status";

const listInclude = {
  category: true,
  versions: {
    include: { sourceDocuments: true },
  },
  reviews: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

const detailInclude = {
  versions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      sourceDocuments: {
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  reviews: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

export async function listReviewingPacks() {
  const packs = await prisma.knowledgePack.findMany({
    where: { status: PackStatus.REVIEWING },
    include: listInclude,
    orderBy: { updatedAt: "desc" },
  });

  const markersByPackId = await batchResolveStoreWorkflowMarkers(
    packs.map((pack) => pack.packId),
  );

  const items = packs
    .map((pack) =>
      toAdminReviewListItem(pack, {
        workflowMarkers: markersByPackId.get(pack.packId) ?? null,
      }),
    )
    .filter((item) => {
      if (item.status === "PUBLISHED" || item.status === "VERIFIED") return false;
      if (!item.reviewStatus) return false;
      return isOpenPackReviewStatus(item.reviewStatus);
    });

  const { batchAttachInboxWorkflow, withInboxWorkflow } = await import(
    "@/lib/admin-work-inbox/admin-work-inbox-workflow"
  );
  const workflowByPack = await batchAttachInboxWorkflow(
    items.map((item) => item.packId),
    { markersByPackId },
  );
  return withInboxWorkflow(items, workflowByPack);
}

export async function getAdminReviewDetail(packId: string): Promise<AdminReviewDetailDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: detailInclude,
  });

  if (!pack) return null;

  const latestVersion = pack.versions[0];
  const distributionRow = latestVersion
    ? await prisma.packDistributionMetadata.findUnique({ where: { versionId: latestVersion.id } })
    : null;

  const { resolveArtifactOptions, toAdminDistributionDto } = await import(
    "@/lib/distribution/distribution-metadata-service"
  );

  let artifactOptions: import("@/lib/admin-review-dto").AdminReviewDetailDto["artifactOptions"] =
    null;
  if (latestVersion) {
    const options = await resolveArtifactOptions(latestVersion.id);
    artifactOptions = options;
  }

  const detailBase = toAdminReviewDetail(pack);

  const detail = applyDistributionFieldsToAdminDetail(detailBase, {
    payload: null,
    currentManifestFingerprint: null,
    distribution: distributionRow ? toAdminDistributionDto(distributionRow) : null,
    artifactOptions,
  });

  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  if (isDoclingBundleReviewSnapshot(snapshot)) {
    const integrity = await validateDoclingReviewIntegrity({
      packId,
      snapshot,
      verifyObjectStorage: "HEAD_ONLY",
    });
    detail.doclingReviewIntegrity = summarizeDoclingReviewIntegrity(integrity);
    // Docling packs skip legacy Builder release-gate overlays (approve uses integrity + drift).
    return detail;
  }

  if (detail.distribution) {
    // Distribution packs skip legacy Builder quality overlays that would block approval.
    return detail;
  }

  const docIds = detail.versions.flatMap((v) => v.sourceDocuments.map((d) => d.id));
  const reports = await loadLatestReportsByDocumentIds(docIds);
  const withValidation = enrichAdminReviewDetailWithValidationReports(detail, reports);
  const structureQuality = await loadStructureQualitySummaryForPack(packId);
  const withStructure = applyStructureQualityToAdminDetail(withValidation, structureQuality);
  const chunkQuality = await loadChunkQualitySummaryForPack(packId);
  const withChunk = applyChunkQualityToAdminDetail(withStructure, chunkQuality);
  const retrievalEvaluation = await loadRetrievalEvaluationSummaryForPack(packId);
  const withRetrieval = applyRetrievalEvaluationToAdminDetail(withChunk, retrievalEvaluation);
  const releaseGate = await loadReleaseGateSummaryForPack(packId);
  return applyReleaseGateToAdminDetail(withRetrieval, releaseGate);
}

export async function validateAdminPackSourceDocuments(input: {
  packId: string;
  sourceDocumentId?: string;
  reviewerClientId?: string;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (input.sourceDocumentId?.trim()) {
    const sourceDocumentId = input.sourceDocumentId.trim();
    const doc = await prisma.sourceDocument.findFirst({
      where: { id: sourceDocumentId, version: { packId } },
    });
    if (!doc) {
      return { error: "NOT_FOUND" as const, message: "원천 문서를 찾을 수 없습니다." };
    }
    await validateAndPersistSourceDocument(sourceDocumentId, {
      actorClientId: input.reviewerClientId,
      triggerType: "SOURCE_DOCUMENT_VALIDATE",
    });
  } else {
    await validateAllSourceDocumentsForPack(packId, {
      actorClientId: input.reviewerClientId,
    });
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}

export async function evaluateAdminPackStructureQuality(input: {
  packId: string;
  reviewerClientId?: string;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  const result = await evaluatePackStructureQuality({
    packId,
    actorClientId: input.reviewerClientId,
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return { error: "NOT_FOUND" as const };
    }
    return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail!, evaluation: result };
}

export async function evaluateAdminPackChunkQuality(input: {
  packId: string;
  reviewerClientId?: string;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  const result = await evaluatePackChunkQuality({
    packId,
    actorClientId: input.reviewerClientId,
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return { error: "NOT_FOUND" as const };
    }
    if (result.error === "NO_VERSION") {
      return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
    }
    return {
      error: "INCOMPLETE" as const,
      message: result.message,
    };
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail!, evaluation: result };
}

function mapAdminRetrievalEvaluationServiceError(
  result:
    | { error: "NOT_FOUND" }
    | { error: "NO_VERSION" }
    | { error: "CHUNK_QUALITY_NOT_READY"; message: string }
    | { error: "STRUCTURE_QUALITY_NOT_READY"; message: string }
    | { error: "NO_ACTIVE_CHUNKS"; message: string }
    | { error: "INCOMPLETE"; code: "CASES_EMPTY"; message: string }
    | { error: "RETRIEVAL_EVAL_CASES_MISSING"; message: string },
) {
  if (result.error === "NOT_FOUND") {
    return { error: "NOT_FOUND" as const };
  }
  if (result.error === "NO_VERSION") {
    return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
  }
  return {
    error: "INCOMPLETE" as const,
    message: result.message,
  };
}

export async function generateAdminPackRetrievalEvaluationCases(input: {
  packId: string;
  reviewerClientId?: string;
  replace?: boolean;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (!canRunAdminRetrievalEvaluationForStatus(pack.status)) {
    return {
      error: "NOT_EDITABLE" as const,
      message: "검색 품질 평가는 DRAFT 또는 REVIEWING 상태에서만 실행할 수 있습니다.",
    };
  }

  const result = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId: input.reviewerClientId,
    replace: input.replace,
  });

  if ("error" in result) {
    return mapAdminRetrievalEvaluationServiceError(result);
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail!, evaluation: result };
}

export async function runAdminPackRetrievalEvaluation(input: {
  packId: string;
  reviewerClientId?: string;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (!canRunAdminRetrievalEvaluationForStatus(pack.status)) {
    return {
      error: "NOT_EDITABLE" as const,
      message: "검색 품질 평가는 DRAFT 또는 REVIEWING 상태에서만 실행할 수 있습니다.",
    };
  }

  const result = await runRetrievalEvaluationForPack({
    packId,
    actorClientId: input.reviewerClientId,
  });

  if ("error" in result) {
    return mapAdminRetrievalEvaluationServiceError(result);
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail!, evaluation: result };
}

export async function evaluateAdminPackReleaseGate(input: {
  packId: string;
  reviewerClientId?: string;
  targetStatus?: "PUBLISHED" | "VERIFIED";
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  const targetStatus = input.targetStatus ?? "PUBLISHED";
  const result = await evaluateReleaseGateForPack({
    packId,
    actorClientId: input.reviewerClientId,
    targetStatus,
    persist: true,
  });

  if ("error" in result) {
    return { error: "NOT_FOUND" as const };
  }

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail!, releaseGate: result.result };
}

export async function acceptPackReview(input: {
  packId: string;
  reviewerClientId?: string;
  reviewerUserId?: string | null;
}) {
  const packId = input.packId.trim();

  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.REVIEWING) {
    return { error: "NOT_REVIEWING" as const };
  }

  const pending = await prisma.packReview.findFirst({
    where: { packId, status: PackReviewStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    const open = await prisma.packReview.findFirst({
      where: { packId, status: { in: [...OPEN_PACK_REVIEW_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (open?.status === PackReviewStatus.IN_REVIEW) {
      return { error: "ALREADY_ACCEPTED" as const };
    }
    return { error: "NO_PENDING_REVIEW" as const };
  }

  const detailBeforeAccept = await getAdminReviewDetail(packId);
  if (!detailBeforeAccept) {
    return { error: "NOT_FOUND" as const };
  }
  const acceptSnapshot = detailBeforeAccept.latestReview?.submitSnapshot ?? null;
  if (isDoclingBundleReviewSnapshot(acceptSnapshot)) {
    try {
      await assertDoclingReviewIntegrityOrThrow({
        packId,
        snapshot: acceptSnapshot,
        verifyObjectStorage: "FULL",
        actorUserId: input.reviewerUserId,
      });
      const versionId = acceptSnapshot.submittedVersionId;
      const { assertCurrentServiceValidationEvidence } = await import(
        "@/lib/distribution/service-validation-service"
      );
      await assertCurrentServiceValidationEvidence({
        packId,
        versionId,
        snapshot: acceptSnapshot,
      });
    } catch (error) {
      if (isDoclingImportError(error)) {
        return { error: "INCOMPLETE" as const, message: error.message };
      }
      const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
      if (isPayloadServiceError(error)) {
        return { error: "INCOMPLETE" as const, message: error.message };
      }
      throw error;
    }
  }

  await prisma.packReview.update({
    where: { id: pending.id },
    data: {
      status: PackReviewStatus.IN_REVIEW,
      reviewerClientId: input.reviewerClientId ?? null,
      reviewerUserId: input.reviewerUserId ?? null,
    },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_UPDATE,
    entityType: "PackReview",
    entityId: pending.id,
    actorUserId: input.reviewerUserId,
    metadata: {
      packId,
      action: "ACCEPT",
      previousStatus: PackReviewStatus.PENDING,
      status: PackReviewStatus.IN_REVIEW,
      adminUserId: input.reviewerUserId ?? null,
      reviewerClientId: input.reviewerClientId ?? null,
    },
  });

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}


// P12.4 — publishing operations live in src/lib/publishing/*; keep stable import path.
export {
  approvePackReview,
  rejectPackReview,
  unpublishPackReview,
  restorePublishedPackAfterUnpublish,
  publishNewRevisionAfterUnpublish,
} from "@/lib/publishing";
