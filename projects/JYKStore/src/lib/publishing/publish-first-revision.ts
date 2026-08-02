import { AuditAction, PackStatus } from "@prisma/client";
import { detectSubmitSnapshotDrift } from "@/lib/admin-review-decision";
import { isDoclingBundleReviewSnapshot } from "@/lib/provider-review-submit-snapshot";
import { assertProviderReviewBindingCurrent, resolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import {
  assertDoclingReviewIntegrityOrThrow,
} from "@/lib/docling-import/docling-review-integrity-service";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { resolveReviewPackageMode } from "@/lib/review/review-package-mode";
import { evaluateReleaseGateForPack } from "@/lib/release-gate/release-gate-service";
import {
  RELEASE_GATE_APPROVAL_BLOCKED_MESSAGE,
  getFirstBlockerMessage,
} from "@/lib/release-gate/release-gate-runner";
import { releaseGateAllowsApprovalStatus } from "@/lib/release-gate/release-gate-readiness";
import { prisma } from "@/lib/prisma";
import {
  PackReviewStatus,
  isAdminReviewAccepted,
} from "@/lib/pack-review-status";
import { resolvePublishEligibilityBlock } from "@/lib/publishing/publish-eligibility-policy";
import {
  recordApprovalPipeline,
  validateApprovalReadiness,
} from "@/lib/publishing/publish-pipeline-records";
import { loadAdminReviewDetail } from "@/lib/publishing/load-admin-review-detail";

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
  const detailBefore = await loadAdminReviewDetail(packId);

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
  const eligibilityBlock = resolvePublishEligibilityBlock({
    serviceValidationPhase: workflowMarkers.serviceValidationPhase,
    providerReviewPhase: workflowMarkers.providerReviewPhase,
    providerSupplementPhase: workflowMarkers.providerSupplementPhase,
    packStatus: detailBefore.pack.status,
  });
  if (eligibilityBlock) {
    return eligibilityBlock;
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
    const detail = await loadAdminReviewDetail(packId);
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

  const detail = await loadAdminReviewDetail(packId);
  return { detail: detail! };
}
