import { AuditAction, PackStatus, PipelineStatus } from "@prisma/client";
import {
  toAdminReviewDetail,
  toAdminReviewListItem,
  enrichAdminReviewDetailWithValidationReports,
  applyStructureQualityToAdminDetail,
  type AdminReviewDetailDto,
} from "@/lib/admin-review-dto";
import {
  getLatestKnowledgeQualityReport,
  getLatestStructureCoverageReport,
  evaluatePackStructureQuality,
} from "@/lib/structure-quality/structure-quality-evaluate-service";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
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

  const detail = toAdminReviewDetail(pack);
  const docIds = detail.versions.flatMap((v) => v.sourceDocuments.map((d) => d.id));
  const reports = await loadLatestReportsByDocumentIds(docIds);
  const withValidation = enrichAdminReviewDetailWithValidationReports(detail, reports);
  const [structureCoverage, knowledgeQuality] = await Promise.all([
    getLatestStructureCoverageReport(packId),
    getLatestKnowledgeQualityReport(packId),
  ]);
  const structureQuality: StructureQualitySummaryDto | null =
    structureCoverage || knowledgeQuality
      ? {
          structureTemplateKey:
            pack.structureTemplateKey ?? structureCoverage?.templateKey ?? "",
          structureTemplateName:
            structureCoverage?.templateName ?? pack.structureTemplateKey ?? "—",
          structureCoverage,
          knowledgeQuality,
        }
      : null;
  return applyStructureQualityToAdminDetail(withValidation, structureQuality);
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

function validateApprovalReadiness(detail: AdminReviewDetailDto): string | null {
  if (!detail.readiness.canApprove) {
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
    return "승인에 필요한 버전·원천 문서·설명을 확인해 주세요.";
  }
  return null;
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
