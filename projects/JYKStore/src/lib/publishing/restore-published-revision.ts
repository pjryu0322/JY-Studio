import { AuditAction, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRestorePublishedIdentity } from "@/lib/publishing/publish-identity-policy";
import { loadAdminReviewDetail } from "@/lib/publishing/load-admin-review-detail";

export async function restorePublishedPackAfterUnpublish(input: {
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
  const identity = assertRestorePublishedIdentity(recovery);
  if (!identity.ok) {
    return {
      error: identity.error,
      message: identity.message,
      code: identity.code as
        | "NEW_REVISION_PENDING"
        | "UNPUBLISH_SNAPSHOT_MISSING"
        | "PRESERVED_GENERATION_NOT_ACTIVE"
        | "PROVIDER_SUPPLEMENT_OPEN"
        | "UNRESOLVED_CORRECTION"
        | "PUBLISH_RECOVERY_BLOCKED"
        | "SEARCH_GENERATION_NOT_READY",
    };
  }

  const snapshot = recovery.unpublishSnapshot;
  if (!snapshot) {
    return {
      error: "INCOMPLETE" as const,
      message: "Unpublish 스냅샷이 없습니다.",
      code: "UNPUBLISH_SNAPSHOT_MISSING" as const,
    };
  }
  const preservedId = snapshot.preservedProductionGenerationId;
  const preservedVersionId = snapshot.preservedVersionId;

  const nextStatus = input.publishAsVerified ? PackStatus.VERIFIED : PackStatus.PUBLISHED;
  const now = new Date();
  const memo = input.memo?.trim() || null;

  try {
    const { PayloadServiceError } = await import("@/lib/distribution/payload-errors");
    const { recordProviderAudit: recordAuditInTx } = await import("@/lib/provider-audit");
    await prisma.$transaction(async (tx) => {
      const stillValid = await tx.searchIndexGeneration.findFirst({
        where: {
          id: preservedId,
          packId,
          versionId: preservedVersionId,
          scope: "PRODUCTION",
          status: "PROMOTED",
          staleAt: null,
          retiredAt: null,
        },
        select: { id: true },
      });
      if (!stillValid) {
        throw new PayloadServiceError(
          "SEARCH_GENERATION_NOT_READY",
          "보존된 PRODUCTION 세대가 유효하지 않아 복구할 수 없습니다.",
          409,
        );
      }

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
          "게시 상태가 변경되어 기존 게시본을 다시 게시할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
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
          action: "RESTORE_EXISTING_AFTER_UNPUBLISH",
          memo,
          restoredAt: now.toISOString(),
          adminUserId: input.reviewerUserId ?? null,
          reviewerClientId: input.reviewerClientId ?? null,
          preservedProductionGenerationId: preservedId,
          preservedVersionId,
          restoredGenerationId: preservedId,
          restoredVersionId: preservedVersionId,
          nextStatus,
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

  const detail = await loadAdminReviewDetail(packId);
  return {
    detail: detail!,
    preservedGenerationId: preservedId,
    preservedVersionId,
    restoredGenerationId: preservedId,
    restoredVersionId: preservedVersionId,
    status: nextStatus,
  };
}

/**
 * P9.1 New Revision Publish after unpublish — promote current DRAFT READY B, then publish.
 *
 * Reuses promoteSearchGeneration (same as approvePackReview). Does not restore preserved A.
 * Requires Reviewed B = promoted B = served B.
 */
