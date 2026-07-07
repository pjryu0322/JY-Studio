import { AuditAction, PackStatus } from "@prisma/client";
import {
  toAdminReviewDetail,
  toAdminReviewListItem,
  type AdminReviewDetailDto,
} from "@/lib/admin-review-dto";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";

const listInclude = {
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

  return packs.map(toAdminReviewListItem);
}

export async function getAdminReviewDetail(packId: string): Promise<AdminReviewDetailDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: detailInclude,
  });

  if (!pack) return null;

  return toAdminReviewDetail(pack);
}

function validateApprovalReadiness(detail: AdminReviewDetailDto): string | null {
  if (!detail.readiness.canApprove) {
    if (detail.pack.status !== "REVIEWING") {
      return "검수 중(REVIEWING) 상태의 지식팩만 승인할 수 있습니다.";
    }
    return "승인에 필요한 버전·원천 문서·설명을 확인해 주세요.";
  }
  return null;
}

export async function approvePackReview(input: {
  packId: string;
  reviewerClientId?: string;
  memo?: string;
  publishAsVerified?: boolean;
}) {
  const packId = input.packId.trim();
  const detailBefore = await getAdminReviewDetail(packId);

  if (!detailBefore) {
    return { error: "NOT_FOUND" as const };
  }

  if (detailBefore.pack.status !== "REVIEWING") {
    return { error: "NOT_REVIEWING" as const };
  }

  const readinessError = validateApprovalReadiness(detailBefore);
  if (readinessError) {
    return { error: "INCOMPLETE" as const, message: readinessError };
  }

  const publishAsVerified = Boolean(input.publishAsVerified);
  const nextStatus = publishAsVerified ? PackStatus.VERIFIED : PackStatus.PUBLISHED;
  const memo = input.memo?.trim() || null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgePack.update({
      where: { packId },
      data: {
        status: nextStatus,
        publishedAt: now,
        isVerified: publishAsVerified,
      },
    });

    const pending = await tx.packReview.findFirst({
      where: { packId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      await tx.packReview.update({
        where: { id: pending.id },
        data: {
          status: "APPROVED",
          decision: "APPROVE",
          memo,
          reviewerClientId: input.reviewerClientId ?? null,
          decidedAt: now,
        },
      });
    } else {
      await tx.packReview.create({
        data: {
          packId,
          status: "APPROVED",
          decision: "APPROVE",
          memo,
          reviewerClientId: input.reviewerClientId ?? null,
          decidedAt: now,
        },
      });
    }
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_PACK_APPROVE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { publishAsVerified, memo },
  });

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}

export async function rejectPackReview(input: {
  packId: string;
  reviewerClientId?: string;
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

  const memo = input.memo?.trim() || null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.DRAFT },
    });

    const pending = await tx.packReview.findFirst({
      where: { packId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      await tx.packReview.update({
        where: { id: pending.id },
        data: {
          status: "REJECTED",
          decision: "REJECT",
          memo,
          rejectionReason,
          reviewerClientId: input.reviewerClientId ?? null,
          decidedAt: now,
        },
      });
    } else {
      await tx.packReview.create({
        data: {
          packId,
          status: "REJECTED",
          decision: "REJECT",
          memo,
          rejectionReason,
          reviewerClientId: input.reviewerClientId ?? null,
          decidedAt: now,
        },
      });
    }
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_PACK_REJECT,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { rejectionReason, memo },
  });

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}
