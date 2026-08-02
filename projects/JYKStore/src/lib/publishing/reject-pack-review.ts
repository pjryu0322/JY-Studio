import { AuditAction, PackStatus } from "@prisma/client";
import { canRejectWithoutAccept } from "@/lib/admin-review-decision";
import { prisma } from "@/lib/prisma";
import {
  OPEN_PACK_REVIEW_STATUSES,
  PackReviewStatus,
  isAdminReviewAccepted,
} from "@/lib/pack-review-status";
import { recordRejectionPipeline } from "@/lib/publishing/publish-pipeline-records";
import { loadAdminReviewDetail } from "@/lib/publishing/load-admin-review-detail";

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
      const detailForReject = await loadAdminReviewDetail(packId);
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

  const detail = await loadAdminReviewDetail(packId);
  return { detail: detail! };
}

/**
 * P6.1 — Unpublish a published pack without deleting Published Revision data.
 * Public retrieval is blocked by pack status; SearchIndexGeneration rows remain.
 */
