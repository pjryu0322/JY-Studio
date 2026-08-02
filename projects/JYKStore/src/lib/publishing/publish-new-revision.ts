import { AuditAction, PackStatus } from "@prisma/client";
import { assertProviderReviewBindingCurrent, resolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import { prisma } from "@/lib/prisma";
import { resolvePublishEligibilityBlock } from "@/lib/publishing/publish-eligibility-policy";
import { assertPublishNewRevisionIdentity } from "@/lib/publishing/publish-identity-policy";
import { loadAdminReviewDetail } from "@/lib/publishing/load-admin-review-detail";

export async function publishNewRevisionAfterUnpublish(input: {
  packId: string;
  reviewerClientId?: string;
  reviewerUserId?: string | null;
  memo?: string;
  publishAsVerified?: boolean;
}) {
  const { resolvePublishRecoveryForPack } = await import("@/lib/workflow/publish-recovery");
  const packId = input.packId.trim();
  const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (!pack) return { error: "NOT_FOUND" as const };
  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_UNPUBLISHED_DRAFT" as const };
  }

  const recovery = await resolvePublishRecoveryForPack(packId);
  const modeIdentity = assertPublishNewRevisionIdentity({ recovery });
  if (!modeIdentity.ok) {
    return {
      error: modeIdentity.error,
      message: modeIdentity.message,
      code: modeIdentity.code,
    };
  }

  const workflowMarkers = await resolveStoreWorkflowMarkers(packId);
  const eligibilityBlock = resolvePublishEligibilityBlock({
    serviceValidationPhase: workflowMarkers.serviceValidationPhase,
    providerReviewPhase: workflowMarkers.providerReviewPhase,
    providerSupplementPhase: workflowMarkers.providerSupplementPhase,
    packStatus: pack.status,
    messages: {
      openSupplement: "제공자 보완요청이 처리되지 않아 게시할 수 없습니다.",
      providerConfirm: "제공자 확인이 완료된 뒤에만 새 Revision을 게시할 수 있습니다.",
      serviceValidation: "서비스 검증이 완료된 뒤에만 새 Revision을 게시할 수 있습니다.",
    },
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
  const bindingIdentity = assertPublishNewRevisionIdentity({
    recovery,
    reviewedGenerationId: reviewBinding.binding.indexGenerationId,
  });
  if (!bindingIdentity.ok) {
    return {
      error: bindingIdentity.error,
      message: bindingIdentity.message,
      code: bindingIdentity.code,
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

  const nextStatus = input.publishAsVerified ? PackStatus.VERIFIED : PackStatus.PUBLISHED;
  const now = new Date();
  const memo = input.memo?.trim() || null;
  const reviewedGenerationId = reviewBinding.binding.indexGenerationId;
  const reviewedVersionId = reviewBinding.binding.versionId;

  try {
    const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
    const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");
    const { promoteSearchGeneration } = await import(
      "@/lib/search-generation/search-generation-service"
    );

    await prisma.$transaction(async (tx) => {
      await promoteSearchGeneration(reviewedGenerationId, tx);

      const packTransition = await tx.knowledgePack.updateMany({
        where: { packId, status: PackStatus.DRAFT },
        data: {
          status: nextStatus,
          isVerified: nextStatus === PackStatus.VERIFIED,
          publishedAt: pack.publishedAt ?? now,
        },
      });
      if (packTransition.count !== 1) {
        throw new PayloadServiceError(
          "APPROVAL_TRANSITION_CONFLICT",
          "게시 상태가 변경되어 새 Revision을 게시할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
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
          action: "PUBLISH_NEW_REVISION_AFTER_UNPUBLISH",
          memo,
          publishedAt: now.toISOString(),
          adminUserId: input.reviewerUserId ?? null,
          reviewerClientId: input.reviewerClientId ?? null,
          reviewedGenerationId,
          publishedGenerationId: reviewedGenerationId,
          versionId: reviewedVersionId,
          previousPreservedProductionGenerationId: recovery.preservedGenerationId,
          nextStatus,
        },
      });
    });
  } catch (error) {
    const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
    if (isPayloadServiceError(error)) {
      return {
        error: "CONFLICT" as const,
        message: error.message,
        code: error.code,
      };
    }
    throw error;
  }

  const detail = await loadAdminReviewDetail(packId);
  return {
    detail: detail!,
    reviewedGenerationId,
    publishedGenerationId: reviewedGenerationId,
    servedGenerationId: reviewedGenerationId,
    versionId: reviewedVersionId,
    status: nextStatus,
  };
}
