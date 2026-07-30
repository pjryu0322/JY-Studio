import { AuditAction, PackStatus, PipelineStatus } from "@prisma/client";
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
  RELEASE_GATE_APPROVAL_BLOCKED_MESSAGE,
  getFirstBlockerMessage,
} from "@/lib/release-gate/release-gate-runner";
import { releaseGateAllowsApprovalStatus } from "@/lib/release-gate/release-gate-readiness";
import {
  canApproveAdminReview,
  canRejectWithoutAccept,
  detectSubmitSnapshotDrift,
} from "@/lib/admin-review-decision";
import {
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import { resolveStoreWorkflowMarkers, batchResolveStoreWorkflowMarkers, assertProviderReviewBindingCurrent } from "@/lib/store-workflow-markers";
import { canPublish } from "@/lib/workflow/admin-workflow-gates";
import {
  assertDoclingReviewIntegrityOrThrow,
  summarizeDoclingReviewIntegrity,
  validateDoclingReviewIntegrity,
} from "@/lib/docling-import/docling-review-integrity-service";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { resolveReviewPackageMode } from "@/lib/review/review-package-mode";
import {
  validateAllSourceDocumentsForPack,
  validateAndPersistSourceDocument,
  loadLatestReportsByDocumentIds,
} from "@/lib/source-validation/source-validation-report-service";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";
import { getApprovalBlockingSourceValidationMessage } from "@/lib/source-validation-readiness";
import {
  OPEN_PACK_REVIEW_STATUSES,
  PackReviewStatus,
  isAdminReviewAccepted,
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

  return packs
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

function validateApprovalReadiness(detail: AdminReviewDetailDto): string | null {
  if (canApproveAdminReview(detail)) {
    return null;
  }
  if (detail.pack.status !== "REVIEWING") {
    return "검수 중(REVIEWING) 상태의 지식팩만 승인할 수 있습니다.";
  }
  const sourceBlock = getApprovalBlockingSourceValidationMessage(
    detail.readiness.sourceValidation,
  );
  if (sourceBlock) {
    return sourceBlock;
  }
  if (detail.readiness.structureQualityMessage) {
    return detail.readiness.structureQualityMessage;
  }
  if (detail.readiness.chunkQualityMessage) {
    return detail.readiness.chunkQualityMessage;
  }
  if (detail.readiness.retrievalEvaluationMessage) {
    return detail.readiness.retrievalEvaluationMessage;
  }
  if (detail.readiness.releaseGateMessage) {
    return detail.readiness.releaseGateMessage;
  }
  return "승인에 필요한 버전·원천 문서·설명을 확인해 주세요.";
}

async function recordApprovalPipeline(packId: string, reviewerClientId?: string) {
  const targetStatus = PipelineStatus.PUBLISHED;
  const triggerType = "ADMIN_APPROVE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: reviewerClientId,
      steps: [PipelineStatus.APPROVED, PipelineStatus.PUBLISHED],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.APPROVED,
        status: "PASS",
        message: "관리자 승인 완료",
      });
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.PUBLISHED,
        status: "PASS",
        message: "배포 처리 완료",
      });
      await finishPipelineRun({ runId: run.runId, status: "PASS", summary: "승인 및 배포 완료" });
    } else {
      logPipelineRecordFailure("recordApprovalPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: reviewerClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordApprovalPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordApprovalPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

async function recordRejectionPipeline(
  packId: string,
  rejectionReason: string,
  reviewerClientId?: string,
) {
  const targetStatus = PipelineStatus.SOURCE_REGISTERING;
  const triggerType = "ADMIN_REJECT";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: reviewerClientId,
      steps: [PipelineStatus.REVIEWING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.REVIEWING,
        status: "FAIL",
        message: rejectionReason,
      });
      await finishPipelineRun({ runId: run.runId, status: "FAIL", summary: "검수 반려" });
    } else {
      logPipelineRecordFailure("recordRejectionPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: reviewerClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordRejectionPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordRejectionPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
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

export async function approvePackReview(input: {
  packId: string;
  reviewerClientId?: string;
  reviewerUserId?: string | null;
  memo?: string;
  publishAsVerified?: boolean;
  /** Optional Object Storage backend (tests inject InMemoryObjectStorage). */
  storage?: import("@/lib/distribution/payload-storage").PayloadStorage;
}) {
  const packId = input.packId.trim();
  const detailBefore = await getAdminReviewDetail(packId);

  if (!detailBefore) {
    return { error: "NOT_FOUND" as const };
  }

  if (detailBefore.pack.status !== "REVIEWING") {
    return { error: "NOT_REVIEWING" as const };
  }

  if (!isAdminReviewAccepted(detailBefore.latestReview?.status)) {
    return { error: "NOT_ACCEPTED" as const };
  }

  const workflowMarkers = await resolveStoreWorkflowMarkers(packId);
  if (isOpenProviderSupplementPhase(workflowMarkers.providerSupplementPhase)) {
    return {
      error: "INCOMPLETE" as const,
      message: "제공자 보완요청이 처리되지 않아 승인할 수 없습니다.",
      code: "PROVIDER_SUPPLEMENT_OPEN" as const,
    };
  }
  if (
    !canPublish({
      serviceValidationPhase: workflowMarkers.serviceValidationPhase,
      providerReviewPhase: workflowMarkers.providerReviewPhase,
      openSupplement: isOpenProviderSupplementPhase(workflowMarkers.providerSupplementPhase),
      packStatus: detailBefore.pack.status,
    })
  ) {
    if (workflowMarkers.providerReviewPhase !== "CONFIRMED") {
      return {
        error: "INCOMPLETE" as const,
        message: "제공자 확인이 완료된 뒤에만 승인할 수 있습니다.",
        code: "PROVIDER_CONFIRM_REQUIRED" as const,
      };
    }
    if (workflowMarkers.serviceValidationPhase !== "PASSED") {
      return {
        error: "INCOMPLETE" as const,
        message: "서비스 검증이 완료된 뒤에만 승인할 수 있습니다.",
        code: "SERVICE_VALIDATION_REQUIRED" as const,
      };
    }
    return {
      error: "INCOMPLETE" as const,
      message: "게시 조건을 충족하지 않습니다.",
      code: "PUBLISH_GATE_NOT_READY" as const,
    };
  }

  const reviewBinding = await assertProviderReviewBindingCurrent(packId);
  if (!reviewBinding.ok) {
    return {
      error: "INCOMPLETE" as const,
      message: reviewBinding.message,
      code: reviewBinding.code as "PROVIDER_CONFIRM_REQUIRED" | "PROVIDER_REVIEW_STALE",
    };
  }

  const openCorrections = await prisma.correctionCase.count({
    where: {
      packId,
      status: { in: ["OPEN", "APPLIED", "REGENERATED"] },
    },
  });
  if (openCorrections > 0) {
    return {
      error: "INCOMPLETE" as const,
      message: "미해결 보정 건이 있어 게시할 수 없습니다.",
      code: "UNRESOLVED_CORRECTION" as const,
    };
  }

  const approveSnapshot = detailBefore.latestReview?.submitSnapshot ?? null;
  let verifiedSnapshotFingerprint: string | null = null;
  if (isDoclingBundleReviewSnapshot(approveSnapshot)) {
    try {
      await assertDoclingReviewIntegrityOrThrow({
        packId,
        snapshot: approveSnapshot,
        verifyObjectStorage: "FULL",
        actorUserId: input.reviewerUserId,
        storage: input.storage,
      });
      const { computeReviewSubmitSnapshotFingerprint } = await import(
        "@/lib/distribution/review-submit-snapshot-fingerprint"
      );
      verifiedSnapshotFingerprint = computeReviewSubmitSnapshotFingerprint(approveSnapshot);
      const { assertCurrentServiceValidationEvidence } = await import(
        "@/lib/distribution/service-validation-service"
      );
      await assertCurrentServiceValidationEvidence({
        packId,
        versionId: approveSnapshot.submittedVersionId,
        snapshot: approveSnapshot,
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

  if (detailBefore.distribution && detailBefore.versions[0]) {
    try {
      const { assertPrimaryArtifactReadyForVersion } = await import(
        "@/lib/distribution/distribution-metadata-service"
      );
      await assertPrimaryArtifactReadyForVersion(detailBefore.versions[0].id);
    } catch (error) {
      const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
      if (isPayloadServiceError(error) && error.code === "PACK_PRIMARY_ARTIFACT_NOT_READY") {
        return { error: "INCOMPLETE" as const, message: error.message };
      }
      throw error;
    }
  }

  const readinessError = validateApprovalReadiness(detailBefore);
  if (readinessError) {
    return { error: "INCOMPLETE" as const, message: readinessError };
  }

  const publishAsVerified = Boolean(input.publishAsVerified);
  const packageMode = resolveReviewPackageMode(approveSnapshot, detailBefore);

  if (packageMode === "DISTRIBUTION_ZIP") {
    return {
      error: "INCOMPLETE" as const,
      message:
        "ZIP Knowledge Package 검수는 더 이상 지원되지 않습니다. Docling import로 다시 제출해 주세요.",
    };
  } else if (packageMode === "DOCLING_BUNDLE") {
    // Integrity already asserted above; drift only — no legacy release gate.
    const drift = detectSubmitSnapshotDrift(detailBefore);
    if (drift.changed) {
      return {
        error: "INCOMPLETE" as const,
        message:
          drift.reasons[0] ??
          "제출 이후 Docling/유통 정보가 변경되었습니다. 다시 검수 요청해 주세요.",
      };
    }
  } else if (packageMode === "LEGACY_BUILDER") {
    const targetStatus = publishAsVerified ? "VERIFIED" : "PUBLISHED";
    const gateResult = await evaluateReleaseGateForPack({
      packId,
      actorClientId: input.reviewerClientId,
      targetStatus,
      persist: true,
      requireReviewingStatus: true,
    });

    if ("error" in gateResult) {
      return { error: "NOT_FOUND" as const };
    }

    if (!releaseGateAllowsApprovalStatus(gateResult.result.status)) {
      const blocker = getFirstBlockerMessage(gateResult.result.issues);
      return {
        error: "INCOMPLETE" as const,
        message: blocker
          ? `${RELEASE_GATE_APPROVAL_BLOCKED_MESSAGE} (${blocker})`
          : RELEASE_GATE_APPROVAL_BLOCKED_MESSAGE,
      };
    }
  }

  const nextStatus = publishAsVerified ? PackStatus.VERIFIED : PackStatus.PUBLISHED;
  const memo = input.memo?.trim() || null;
  const now = new Date();

  const accepted = await prisma.packReview.findFirst({
    where: { packId, status: PackReviewStatus.IN_REVIEW },
    orderBy: { createdAt: "desc" },
  });

  if (!accepted) {
    return { error: "NOT_ACCEPTED" as const };
  }

  const knowledgeMismatchMessage =
    "제출 이후 지식 데이터 또는 검색 인덱스가 변경되었습니다. 제공자에게 다시 검수요청하도록 안내해 주세요.";

  if (packageMode === "DOCLING_BUNDLE" && isDoclingBundleReviewSnapshot(approveSnapshot)) {
    // UX pre-check only — final approval is decided solely by the in-transaction
    // DB snapshot fingerprint + assertApprovalSearchGenerationInTx + service evidence.
    if (
      !approveSnapshot.pipelineRunId ||
      !approveSnapshot.indexGenerationId ||
      !approveSnapshot.searchIndexGenerationId ||
      !approveSnapshot.chunkGenerationId ||
      !verifiedSnapshotFingerprint ||
      (approveSnapshot.snapshotSchemaVersion ?? 1) < 3
    ) {
      return { error: "INCOMPLETE" as const, message: knowledgeMismatchMessage };
    }

    try {
      const { assertApprovalSearchGenerationInTx } = await import(
        "@/lib/distribution/approval-search-generation-evidence"
      );
      const { assertCurrentServiceValidationEvidence } = await import(
        "@/lib/distribution/service-validation-service"
      );
      const { promoteDraftIndexToProduction } = await import(
        "@/lib/docling-knowledge/docling-nd-knowledge-builder"
      );
      const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");
      const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
      const { resolveReviewPackageMode: resolveModeInTx } = await import(
        "@/lib/review/review-package-mode"
      );

      await prisma.$transaction(async (tx) => {
        const evidence = await assertApprovalSearchGenerationInTx(tx, {
          packId,
          reviewId: accepted.id,
          expectedSnapshotFingerprint: verifiedSnapshotFingerprint!,
        });

        if (resolveModeInTx(evidence.snapshot) !== "DOCLING_BUNDLE") {
          throw new PayloadServiceError(
            "APPROVAL_SNAPSHOT_MISMATCH",
            "제출 이후 검수 증적 또는 상태가 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
            409,
          );
        }

        await assertCurrentServiceValidationEvidence({
          client: tx,
          packId,
          versionId: evidence.versionId,
          snapshot: evidence.snapshot,
        });

        if (evidence.generation.id !== reviewBinding.binding.indexGenerationId) {
          throw new PayloadServiceError(
            "APPROVAL_SNAPSHOT_MISMATCH",
            "이전 Revision에 대한 제공자 검토는 현재 게시 대상에 사용할 수 없습니다. 다시 검토하세요.",
            409,
          );
        }

        await promoteDraftIndexToProduction({
          versionId: evidence.versionId,
          pipelineRunId: evidence.pipelineRunId,
          indexGenerationId: evidence.generation.id,
          fingerprint: evidence.fingerprint,
          tx,
          promotionGuard: {
            generationFingerprint: evidence.snapshot.searchGenerationFingerprint!,
            embeddingProvider: evidence.snapshot.embeddingProvider!,
            embeddingModel: evidence.snapshot.embeddingModel!,
            embeddingModelRevision: evidence.snapshot.embeddingModelRevision!,
            embeddingDimension: evidence.snapshot.embeddingDimension!,
            distanceMetric: evidence.snapshot.distanceMetric!,
          },
        });

        const packTransition = await tx.knowledgePack.updateMany({
          where: { packId, status: PackStatus.REVIEWING },
          data: {
            status: nextStatus,
            publishedAt: now,
            isVerified: publishAsVerified,
          },
        });
        if (packTransition.count !== 1) {
          throw new PayloadServiceError(
            "APPROVAL_TRANSITION_CONFLICT",
            "검수 상태가 변경되어 승인할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
            409,
          );
        }

        const reviewTransition = await tx.packReview.updateMany({
          where: {
            id: accepted.id,
            packId,
            status: PackReviewStatus.IN_REVIEW,
          },
          data: {
            status: PackReviewStatus.APPROVED,
            decision: "APPROVE",
            memo,
            reviewerClientId: input.reviewerClientId ?? null,
            reviewerUserId: input.reviewerUserId ?? null,
            decidedAt: now,
          },
        });
        if (reviewTransition.count !== 1) {
          throw new PayloadServiceError(
            "APPROVAL_TRANSITION_CONFLICT",
            "검수 상태가 변경되어 승인할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
            409,
          );
        }

        await recordAuditInTx({
          client: tx,
          action: AuditAction.ADMIN_PACK_APPROVE,
          entityType: "KnowledgePack",
          entityId: packId,
          actorUserId: input.reviewerUserId,
          metadata: {
            publishAsVerified,
            memo,
            adminUserId: input.reviewerUserId ?? null,
            reviewerClientId: input.reviewerClientId ?? null,
            action: "APPROVE",
            pipelineRunId: evidence.pipelineRunId,
            indexGenerationId: evidence.generation.id,
            searchIndexGenerationId: evidence.generation.id,
            embeddingModelRevision: evidence.generation.embeddingModelRevision,
            snapshotFingerprint: evidence.snapshotFingerprint,
          },
        });
      });
    } catch (error) {
      const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
      if (isPayloadServiceError(error)) {
        if (error.httpStatus === 409) {
          return {
            error: "CONFLICT" as const,
            message: error.message,
            code: error.code,
          };
        }
        return { error: "INCOMPLETE" as const, message: error.message };
      }
      throw error;
    }

    await recordApprovalPipeline(packId, input.reviewerClientId);
    const detail = await getAdminReviewDetail(packId);
    return { detail: detail! };
  } else {
    const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
    const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");
    const { promoteSearchGeneration } = await import(
      "@/lib/search-generation/search-generation-service"
    );
    try {
      await prisma.$transaction(async (tx) => {
        // Worker ZIP / legacy path: promote the provider-reviewed READY draft generation.
        await promoteSearchGeneration(reviewBinding.binding.indexGenerationId, tx);

        const packTransition = await tx.knowledgePack.updateMany({
          where: { packId, status: PackStatus.REVIEWING },
          data: {
            status: nextStatus,
            publishedAt: now,
            isVerified: publishAsVerified,
          },
        });
        if (packTransition.count !== 1) {
          throw new PayloadServiceError(
            "APPROVAL_TRANSITION_CONFLICT",
            "검수 상태가 변경되어 승인할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
            409,
          );
        }

        const reviewTransition = await tx.packReview.updateMany({
          where: {
            id: accepted.id,
            packId,
            status: PackReviewStatus.IN_REVIEW,
          },
          data: {
            status: PackReviewStatus.APPROVED,
            decision: "APPROVE",
            memo,
            reviewerClientId: input.reviewerClientId ?? null,
            reviewerUserId: input.reviewerUserId ?? null,
            decidedAt: now,
          },
        });
        if (reviewTransition.count !== 1) {
          throw new PayloadServiceError(
            "APPROVAL_TRANSITION_CONFLICT",
            "검수 상태가 변경되어 승인할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
            409,
          );
        }

        await recordAuditInTx({
          client: tx,
          action: AuditAction.ADMIN_PACK_APPROVE,
          entityType: "KnowledgePack",
          entityId: packId,
          actorUserId: input.reviewerUserId,
          metadata: {
            publishAsVerified,
            memo,
            adminUserId: input.reviewerUserId ?? null,
            reviewerClientId: input.reviewerClientId ?? null,
            action: "APPROVE",
            versionId: reviewBinding.binding.versionId,
            pipelineRunId: reviewBinding.binding.pipelineRunId,
            indexGenerationId: reviewBinding.binding.indexGenerationId,
            searchIndexGenerationId: reviewBinding.binding.indexGenerationId,
            providerReviewedAt: reviewBinding.binding.reviewedAt,
          },
        });
      });
    } catch (error) {
      const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
      if (isPayloadServiceError(error) && error.httpStatus === 409) {
        return {
          error: "CONFLICT" as const,
          message: error.message,
          code: error.code,
        };
      }
      throw error;
    }
  }

  await recordApprovalPipeline(packId, input.reviewerClientId);

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}

export async function rejectPackReview(input: {
  packId: string;
  reviewerClientId?: string;
  reviewerUserId?: string | null;
  memo?: string;
  rejectionReason: string;
}) {
  const packId = input.packId.trim();
  const rejectionReason = input.rejectionReason.trim();

  if (!rejectionReason) {
    return { error: "REJECTION_REASON_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.REVIEWING) {
    return { error: "NOT_REVIEWING" as const };
  }

  const openReview = await prisma.packReview.findFirst({
    where: { packId, status: { in: [...OPEN_PACK_REVIEW_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });

  if (!isAdminReviewAccepted(openReview?.status)) {
    if (openReview?.status === PackReviewStatus.PENDING) {
      const detailForReject = await getAdminReviewDetail(packId);
      if (!detailForReject || !canRejectWithoutAccept(detailForReject)) {
        return { error: "NOT_ACCEPTED" as const };
      }
    } else {
      return { error: "NOT_ACCEPTED" as const };
    }
  }

  const memo = input.memo?.trim() || null;
  const now = new Date();
  const reviewStatusForTransition = openReview!.status;

  try {
    const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
    const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");

    await prisma.$transaction(async (tx) => {
      const packTransition = await tx.knowledgePack.updateMany({
        where: { packId, status: PackStatus.REVIEWING },
        data: { status: PackStatus.DRAFT },
      });
      if (packTransition.count !== 1) {
        throw new PayloadServiceError(
          "REVIEW_TRANSITION_CONFLICT",
          "검수 상태가 변경되어 반려할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
          409,
        );
      }

      const reviewTransition = await tx.packReview.updateMany({
        where: {
          id: openReview!.id,
          packId,
          status: reviewStatusForTransition,
        },
        data: {
          status: PackReviewStatus.REJECTED,
          decision: "REJECT",
          memo,
          rejectionReason,
          reviewerClientId: input.reviewerClientId ?? null,
          reviewerUserId: input.reviewerUserId ?? null,
          decidedAt: now,
        },
      });
      if (reviewTransition.count !== 1) {
        throw new PayloadServiceError(
          "REVIEW_TRANSITION_CONFLICT",
          "검수 상태가 변경되어 반려할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
          409,
        );
      }

      await recordAuditInTx({
        client: tx,
        action: AuditAction.ADMIN_PACK_REJECT,
        entityType: "KnowledgePack",
        entityId: packId,
        actorUserId: input.reviewerUserId,
        metadata: {
          rejectionReason,
          memo,
          adminUserId: input.reviewerUserId ?? null,
          reviewerClientId: input.reviewerClientId ?? null,
          action: "REJECT",
        },
      });
    });
  } catch (error) {
    const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
    if (isPayloadServiceError(error) && error.httpStatus === 409) {
      return {
        error: "CONFLICT" as const,
        message: error.message,
        code: error.code,
      };
    }
    throw error;
  }

  await recordRejectionPipeline(packId, rejectionReason, input.reviewerClientId);

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}

/**
 * P6.1 — Unpublish a published pack without deleting Published Revision data.
 * Public retrieval is blocked by pack status; SearchIndexGeneration rows remain.
 */
export async function unpublishPackReview(input: {
  packId: string;
  reviewerClientId?: string;
  reviewerUserId?: string | null;
  memo?: string;
}) {
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) return { error: "NOT_FOUND" as const };
  if (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED) {
    return { error: "NOT_PUBLISHED" as const };
  }

  const production = await prisma.searchIndexGeneration.findFirst({
    where: {
      packId,
      scope: "PRODUCTION",
      status: "PROMOTED",
    },
    orderBy: { promotedAt: "desc" },
    select: { id: true, versionId: true },
  });

  const now = new Date();
  const memo = input.memo?.trim() || null;
  try {
    const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
    const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");
    await prisma.$transaction(async (tx) => {
      const packTransition = await tx.knowledgePack.updateMany({
        where: {
          packId,
          status: { in: [PackStatus.PUBLISHED, PackStatus.VERIFIED] },
        },
        data: {
          status: PackStatus.DRAFT,
          isVerified: false,
        },
      });
      if (packTransition.count !== 1) {
        throw new PayloadServiceError(
          "APPROVAL_TRANSITION_CONFLICT",
          "게시 상태가 변경되어 게시 취소할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
          409,
        );
      }

      await recordAuditInTx({
        client: tx,
        action: AuditAction.DEPRECATE,
        entityType: "KnowledgePack",
        entityId: packId,
        actorUserId: input.reviewerUserId,
        metadata: {
          action: "UNPUBLISH",
          memo,
          previousStatus: pack.status,
          unpublishedAt: now.toISOString(),
          adminUserId: input.reviewerUserId ?? null,
          reviewerClientId: input.reviewerClientId ?? null,
          preservedProductionGenerationId: production?.id ?? null,
          preservedVersionId: production?.versionId ?? null,
          dataDeleted: false,
        },
      });
    });
  } catch (error) {
    const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
    if (isPayloadServiceError(error) && error.httpStatus === 409) {
      return {
        error: "CONFLICT" as const,
        message: error.message,
        code: error.code,
      };
    }
    throw error;
  }

  const detail = await getAdminReviewDetail(packId);
  return {
    detail: detail!,
    preservedGenerationId: production?.id ?? null,
    preservedVersionId: production?.versionId ?? null,
  };
}
