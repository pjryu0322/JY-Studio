import { Prisma } from "@prisma/client";
import {
  auditAiMemberActionApplyFailedBySystem,
  auditAiMemberActionAppliedBySystem,
  auditAiMemberActionAutoApprovedByPolicy,
  auditAiMemberActionReviewRequired,
} from "@/lib/ai-member/aiMemberActionAudit";
import { resolveAiActionPolicyModes } from "@/lib/ai-member/aiMemberActionApprovalPolicy";
import { ingestApprovedAiMemberActionResult } from "@/lib/ai-member/aiMemberActionResultIngestion";
import { prisma } from "@/lib/prisma";

type AuditBase = Parameters<typeof auditAiMemberActionReviewRequired>[0];

function toAuditBase(
  row: {
    id: string;
    projectId: string;
    taskId: string | null;
    taskPromptId: string | null;
    taskRunId: string | null;
    gitChangeRequestId: string | null;
    actionType: string;
    projectMemberId: string;
    requestedByUserId: string;
    executionMode: string;
    providerKey: string | null;
  },
  pm: { displayName: string | null },
  status: string,
  summary: string
): AuditBase {
  return {
    projectId: row.projectId,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    actionId: row.id,
    actionType: row.actionType,
    projectMemberId: row.projectMemberId,
    aiDisplayName: pm.displayName,
    requestedByUserId: row.requestedByUserId,
    status,
    summary,
    detailJson: {
      actionId: row.id,
      actionType: row.actionType,
      projectMemberId: row.projectMemberId,
      executionMode: row.executionMode,
      providerKey: row.providerKey,
    },
  };
}

/**
 * status=DONE 및 resultPayload 반영 이후 호출: 검토 상태 분기 및 AUTO_APPLY 시 ingest.
 */
export async function processReviewAndOptionalAutoApplyAfterDone(actionId: string): Promise<void> {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    include: {
      projectMember: { select: { displayName: true } },
    },
  });
  if (!row || row.status !== "DONE" || row.resultPayload == null) {
    return;
  }

  if (
    row.reviewStatus === "PENDING_REVIEW" ||
    row.reviewStatus === "APPROVED" ||
    row.reviewStatus === "REJECTED" ||
    row.reviewStatus === "NEEDS_REVISION"
  ) {
    return;
  }

  const fromPolicy = await resolveAiActionPolicyModes(row.projectId, row.actionType);
  const approvalMode = row.resolvedApprovalMode ?? fromPolicy.approvalMode;
  const applyMode = row.resolvedApplyMode ?? fromPolicy.applyMode;

  const pm = row.projectMember;
  const baseRow = {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    actionType: row.actionType,
    projectMemberId: row.projectMemberId,
    requestedByUserId: row.requestedByUserId,
    executionMode: row.executionMode,
    providerKey: row.providerKey,
  };

  if (approvalMode === "MANUAL_REVIEW") {
    await prisma.projectMemberAction.update({
      where: { id: actionId },
      data: {
        reviewStatus: "PENDING_REVIEW",
        reviewedBy: { disconnect: true },
        reviewedAt: null,
        reviewComment: null,
        approvedPayload: Prisma.DbNull,
        applyStatus: "NOT_APPLIED",
        appliedAt: null,
        appliedBy: { disconnect: true },
      },
    });
    await auditAiMemberActionReviewRequired(
      toAuditBase(baseRow, pm, "PENDING_REVIEW", "수동 검토 대기")
    );
    return;
  }

  await prisma.projectMemberAction.update({
    where: { id: actionId },
    data: {
      reviewStatus: "APPROVED",
      reviewedBy: { disconnect: true },
      reviewedAt: new Date(),
      reviewComment: null,
      approvedPayload: row.resultPayload as Prisma.InputJsonValue,
      applyStatus: "NOT_APPLIED",
      appliedAt: null,
      appliedBy: { disconnect: true },
    },
  });

  await auditAiMemberActionAutoApprovedByPolicy(
    toAuditBase(baseRow, pm, "APPROVED", "정책 자동 승인"),
    { approvalMode, applyMode }
  );

  if (applyMode !== "AUTO_APPLY") {
    return;
  }

  const rawPayload = row.resultPayload;
  if (rawPayload == null || typeof rawPayload !== "object") {
    return;
  }
  const resultPayload = rawPayload as Record<string, unknown>;
  const auditBase = toAuditBase(baseRow, pm, "AUTO_APPLY", "정책 자동 적용");

  try {
    await ingestApprovedAiMemberActionResult({
      actionId: row.id,
      projectId: row.projectId,
      actionType: row.actionType,
      taskId: row.taskId,
      gitChangeRequestId: row.gitChangeRequestId,
      taskRunId: row.taskRunId,
      resultPayload,
    });
    await prisma.projectMemberAction.update({
      where: { id: actionId },
      data: {
        applyStatus: "APPLIED",
        appliedAt: new Date(),
        appliedBy: { disconnect: true },
      },
    });
    await auditAiMemberActionAppliedBySystem(auditBase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.projectMemberAction.update({
      where: { id: actionId },
      data: { applyStatus: "APPLY_FAILED" },
    });
    await auditAiMemberActionApplyFailedBySystem(auditBase, msg);
  }
}
