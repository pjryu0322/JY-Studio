import { AuditAction, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadAdminReviewDetail } from "@/lib/publishing/load-admin-review-detail";

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
          "게시 상태가 변경되어 게시 중단할 수 없습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.",
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

  const detail = await loadAdminReviewDetail(packId);
  return {
    detail: detail!,
    preservedGenerationId: production?.id ?? null,
    preservedVersionId: production?.versionId ?? null,
  };
}

/**
 * P9.1 Restore Existing — resume the Unpublish-preserved PRODUCTION revision.
 *
 * Does NOT use current DRAFT READY provider review as evidence for serving A.
 * When a new Draft/Revision exists after unpublish, returns NEW_REVISION_PENDING
 * (use publishNewRevisionAfterUnpublish instead).
 */
