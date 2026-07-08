import { AuditAction, PackStatus, PipelineStatus } from "@prisma/client";
import {
  toAdminReviewDetail,
  toAdminReviewListItem,
  type AdminReviewDetailDto,
} from "@/lib/admin-review-dto";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
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
    if (detail.readiness.sourceValidation.failCount > 0) {
      return "검증에 실패(FAIL)한 원천 문서가 있어 승인할 수 없습니다.";
    }
    return "승인에 필요한 버전·원천 문서·설명을 확인해 주세요.";
  }
  return null;
}

async function recordApprovalPipeline(packId: string, reviewerClientId?: string) {
  try {
    const run = await createPipelineRun({
      packId,
      triggerType: "ADMIN_APPROVE",
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
    }

    await updatePackPipelineStatus({
      packId,
      pipelineStatus: PipelineStatus.PUBLISHED,
      triggeredByClientId: reviewerClientId,
    });
  } catch (error) {
    console.error("recordApprovalPipeline failed", error);
  }
}

async function recordRejectionPipeline(
  packId: string,
  rejectionReason: string,
  reviewerClientId?: string,
) {
  try {
    const run = await createPipelineRun({
      packId,
      triggerType: "ADMIN_REJECT",
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
    }

    await updatePackPipelineStatus({
      packId,
      pipelineStatus: PipelineStatus.SOURCE_REGISTERING,
      triggeredByClientId: reviewerClientId,
    });
  } catch (error) {
    console.error("recordRejectionPipeline failed", error);
  }
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

  await recordApprovalPipeline(packId, input.reviewerClientId);

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

  await recordRejectionPipeline(packId, rejectionReason, input.reviewerClientId);

  const detail = await getAdminReviewDetail(packId);
  return { detail: detail! };
}
