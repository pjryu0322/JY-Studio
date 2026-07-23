import { AuditAction, PackStatus, PipelineStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prepareProviderPackForFinalReviewSubmit } from "@/lib/auto-pipeline/provider-final-review-submit-service";
import { commitDistributionPackForReview } from "@/lib/distribution/distribution-submit-service";
import { buildProviderReviewSubmitSnapshot } from "@/lib/provider-review-submit-snapshot";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  isProviderRejectionAcknowledged,
  withProviderRejectionAcknowledged,
} from "@/lib/pack-review-rejection-ack";

async function recordSubmitForReviewPipeline(
  packId: string,
  clientId: string,
  note: string | null,
) {
  const targetStatus = PipelineStatus.REVIEWING;
  const triggerType = "SUBMIT_FOR_REVIEW";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: clientId,
      steps: [PipelineStatus.READY_FOR_REVIEW, PipelineStatus.REVIEWING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.READY_FOR_REVIEW,
        status: "PASS",
        message: note ?? "검토 준비 완료",
      });
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.REVIEWING,
        status: "PASS",
        message: "관리자 검토 대기열에 등록",
      });
      await finishPipelineRun({
        runId: run.runId,
        status: "PASS",
        summary: "검수 요청 제출 완료",
      });
    } else {
      logPipelineRecordFailure("recordSubmitForReviewPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: clientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordSubmitForReviewPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordSubmitForReviewPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

export async function submitProviderPackForReview(userId: string, clientId: string, packId: string) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: {
        include: { sourceDocuments: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_DRAFT" as const };
  }

  if (!pack.categoryId || !pack.shortDescription.trim() || !pack.description.trim()) {
    return { error: "INCOMPLETE" as const, message: "카테고리와 설명을 확인해 주세요." };
  }

  if (pack.versions.length === 0) {
    return { error: "INCOMPLETE" as const, message: "버전이 최소 1개 필요합니다." };
  }

  const latestVersionId = pack.versions[0]?.id;
  const doclingReady = latestVersionId
    ? await prisma.doclingImportBundle.findFirst({
        where: {
          versionId: latestVersionId,
          isActive: true,
          status: "REVIEW_READY",
        },
        select: { id: true },
      })
    : null;

  if (doclingReady) {
    const distributionResult = await commitDistributionPackForReview(userId, clientId, packId);
    if ("error" in distributionResult) {
      return distributionResult;
    }
    await recordSubmitForReviewPipeline(
      packId,
      clientId,
      "Docling Import 검수 요청",
    );
    const detail = await getProviderPackForClient(userId, clientId, packId);
    const mode =
      distributionResult.snapshot.mode === "DOCLING_BUNDLE"
        ? ("DOCLING_BUNDLE" as const)
        : ("DISTRIBUTION" as const);
    return { pack: detail!, snapshot: distributionResult.snapshot, mode };
  }

  const allDocs = pack.versions.flatMap((v) => v.sourceDocuments);
  if (allDocs.length === 0) {
    return {
      error: "INCOMPLETE" as const,
      message: "원천 문서(SourceDocument)를 최소 1개 등록해 주세요.",
    };
  }

  const preparation = await prepareProviderPackForFinalReviewSubmit({
    packId,
    actorClientId: clientId,
    providerProfileId: profile.id,
  });

  if (!preparation.ok) {
    return {
      error: "INCOMPLETE" as const,
      message: preparation.message,
      preparation,
    };
  }

  const snapshot = buildProviderReviewSubmitSnapshot({
    submittedVersionId: preparation.submittedVersionId,
    sourceDocumentIds: preparation.sourceDocumentIds,
    activeChunkIds: preparation.activeChunkIds,
    retrievalEvaluationSetId: preparation.retrievalEvaluationSetId,
    retrievalEvaluationRunId: preparation.retrievalEvaluationRunId,
    releaseGateRunId: preparation.releaseGateRunId,
    releaseGateStatus: preparation.releaseGateStatus,
    retrievalEvaluationStatus: preparation.retrievalEvaluationStatus,
    warnings: preparation.warnings,
  });

  const onlyEtc = allDocs.every((d) => d.sourceType === "ETC");
  const submitNote = onlyEtc
    ? "모든 원천 문서 유형이 '기타(ETC)'입니다. 자료 유형을 구체적으로 분류하면 검수 품질이 향상됩니다."
    : null;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.knowledgePack.updateMany({
        where: { packId, status: PackStatus.DRAFT },
        data: { status: PackStatus.REVIEWING },
      });
      if (updated.count !== 1) {
        throw new Error("NOT_DRAFT");
      }
      await tx.packReview.create({
        data: {
          packId,
          status: "PENDING",
          submitSnapshot: snapshot,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_DRAFT") {
      return { error: "NOT_DRAFT" as const };
    }
    throw error;
  }

  await recordSubmitForReviewPipeline(packId, clientId, submitNote);

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { packId, submitSnapshot: snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    metadata: { packId, status: "PENDING", submitSnapshot: snapshot },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, preparation, snapshot };
}

export async function withdrawProviderPackFromReview(
  userId: string,
  clientId: string,
  packId: string,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.REVIEWING) {
    return { error: "NOT_REVIEWING" as const };
  }

  const pending = await prisma.packReview.findFirst({
    where: { packId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    const accepted = await prisma.packReview.findFirst({
      where: { packId, status: "IN_REVIEW" },
      orderBy: { createdAt: "desc" },
    });
    if (accepted) {
      return { error: "ALREADY_ACCEPTED" as const };
    }
    return { error: "NO_PENDING_REVIEW" as const };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.DRAFT },
    });

    await tx.packReview.update({
      where: { id: pending.id },
      data: {
        status: "WITHDRAWN",
        decision: "WITHDRAW",
        memo: "제공자가 검수 요청을 회수했습니다.",
        decidedAt: now,
      },
    });
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { packId, action: "withdraw_review", previousStatus: "REVIEWING" },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail! };
}

/**
 * Provider acknowledges the latest admin rejection — unlocks editing after that.
 */
export async function acknowledgeProviderPackRejection(
  userId: string,
  clientId: string,
  packId: string,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    select: { packId: true, status: true },
  });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }
  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_DRAFT" as const };
  }

  const latestRejected = await prisma.packReview.findFirst({
    where: { packId, decision: "REJECT", status: PackReviewStatus.REJECTED },
    orderBy: { decidedAt: "desc" },
    select: { id: true, submitSnapshot: true, rejectionReason: true },
  });
  if (!latestRejected?.rejectionReason?.trim()) {
    return { error: "NO_REJECTION" as const };
  }
  if (isProviderRejectionAcknowledged(latestRejected.submitSnapshot)) {
    const detail = await getProviderPackForClient(userId, clientId, packId);
    return { pack: detail!, alreadyAcknowledged: true as const };
  }

  const now = new Date();
  await prisma.packReview.update({
    where: { id: latestRejected.id },
    data: {
      submitSnapshot: withProviderRejectionAcknowledged(latestRejected.submitSnapshot, {
        acknowledgedAt: now.toISOString(),
        acknowledgedByUserId: userId,
      }) as Prisma.InputJsonValue,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "PackReview",
    entityId: latestRejected.id,
    metadata: { packId, action: "acknowledge_rejection" },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, alreadyAcknowledged: false as const };
}
