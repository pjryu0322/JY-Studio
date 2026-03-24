import { Prisma } from "@prisma/client";
import { AiMemberActionValidationError, auditPayloadFromRow } from "@/lib/service/aiMemberActionService";
import {
  auditAiMemberActionApplied,
  auditAiMemberActionApplyFailed,
  auditAiMemberActionReviewDecision,
} from "@/lib/ai-member/aiMemberActionAudit";
import { ingestApprovedAiMemberActionResult } from "@/lib/ai-member/aiMemberActionResultIngestion";
import type { AiMemberActionReviewDecisionId } from "@/lib/ai-member/aiMemberActionReviewTypes";
import {
  roleCanApplyApprovedAiMemberAction,
  roleCanReviewAiMemberAction,
} from "@/lib/ai-member/aiMemberActionReviewPolicy";
import type { AiMemberActionTypeId } from "@/lib/ai-member/aiMemberActionTypes";
import { getUserProjectRole, requireProjectPermission } from "@/lib/auth/rbacGuard";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
type ActionRow = Prisma.ProjectMemberActionGetPayload<{
  include: {
    projectMember: { select: { id: true; displayName: true; memberType: true; role: true; aiProvider: true } };
  };
}>;

function toAuditBase(row: ActionRow, status: string, summary: string) {
  return auditPayloadFromRow(
    {
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
    },
    row.projectMember,
    status,
    summary
  );
}

function assertReviewableState(reviewStatus: string | null | undefined): void {
  if (reviewStatus === "PENDING_REVIEW" || reviewStatus === "NEEDS_REVISION") {
    return;
  }
  throw new AiMemberActionValidationError("검토할 수 있는 상태가 아닙니다(PENDING_REVIEW 또는 NEEDS_REVISION만 가능).");
}

export async function reviewAiMemberAction(input: {
  actionId: string;
  reviewerUserId: string;
  decision: AiMemberActionReviewDecisionId;
  comment?: string | null;
}): Promise<ActionRow> {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: input.actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  if (row.status !== "DONE") {
    throw new AiMemberActionValidationError("완료(DONE)된 액션만 검토할 수 있습니다.");
  }
  if (row.resolvedApprovalMode === "AUTO_APPROVE") {
    throw new AiMemberActionValidationError(
      "자동 승인 정책으로 생성된 액션은 수동 검토 API로 변경할 수 없습니다."
    );
  }

  await requireProjectPermission(row.projectId, input.reviewerUserId, "canViewProject", "reviewAiMemberAction");
  const role = await getUserProjectRole(row.projectId, input.reviewerUserId);
  const actionType = row.actionType as AiMemberActionTypeId;
  if (!roleCanReviewAiMemberAction(role, actionType)) {
    throw new ProjectAccessDeniedError("이 액션 유형을 검토할 권한이 없습니다.");
  }

  assertReviewableState(row.reviewStatus ?? undefined);

  const comment = input.comment?.trim() || null;
  const now = new Date();

  let reviewStatus: "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  let approvedPayload: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;

  if (input.decision === "APPROVE") {
    if (row.resultPayload == null || (typeof row.resultPayload === "object" && Object.keys(row.resultPayload as object).length === 0)) {
      throw new AiMemberActionValidationError("승인할 결과(resultPayload)가 없습니다.");
    }
    reviewStatus = "APPROVED";
    approvedPayload = row.resultPayload as Prisma.InputJsonValue;
  } else if (input.decision === "REJECT") {
    reviewStatus = "REJECTED";
    approvedPayload = undefined;
  } else {
    reviewStatus = "NEEDS_REVISION";
    approvedPayload = undefined;
  }

  await prisma.aiMemberActionReviewLog.create({
    data: {
      actionId: row.id,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      comment,
    },
  });

  const updated = await prisma.projectMemberAction.update({
    where: { id: row.id },
    data: {
      reviewStatus,
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: now,
      reviewComment: comment,
      approvedPayload:
        reviewStatus === "APPROVED" && approvedPayload !== undefined
          ? approvedPayload
          : Prisma.DbNull,
      applyStatus: "NOT_APPLIED",
      appliedAt: null,
      appliedByUserId: null,
    },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  await auditAiMemberActionReviewDecision({
    base: toAuditBase(updated, reviewStatus, `검토 결정: ${input.decision}`),
    reviewerUserId: input.reviewerUserId,
    decision: input.decision,
    reviewComment: comment,
  });

  return updated;
}

export async function approveAiMemberAction(actionId: string, reviewerUserId: string, comment?: string | null) {
  return reviewAiMemberAction({ actionId, reviewerUserId, decision: "APPROVE", comment });
}

export async function rejectAiMemberAction(actionId: string, reviewerUserId: string, comment?: string | null) {
  return reviewAiMemberAction({ actionId, reviewerUserId, decision: "REJECT", comment });
}

export async function requestRevisionAiMemberAction(actionId: string, reviewerUserId: string, comment?: string | null) {
  return reviewAiMemberAction({ actionId, reviewerUserId, decision: "REQUEST_REVISION", comment });
}

export async function applyApprovedAiMemberAction(actionId: string, actorUserId: string): Promise<ActionRow> {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await requireProjectPermission(row.projectId, actorUserId, "canViewProject", "applyApprovedAiMemberAction");
  const role = await getUserProjectRole(row.projectId, actorUserId);
  const actionType = row.actionType as AiMemberActionTypeId;
  if (!roleCanApplyApprovedAiMemberAction(role, actionType)) {
    throw new ProjectAccessDeniedError("승인 결과를 적용할 권한이 없습니다.");
  }

  if (row.reviewStatus !== "APPROVED") {
    throw new AiMemberActionValidationError("승인(APPROVED)된 액션만 적용할 수 있습니다.");
  }
  if (row.applyStatus === "APPLIED") {
    throw new AiMemberActionValidationError("이미 적용된 액션입니다.");
  }

  const rawPayload = row.approvedPayload ?? row.resultPayload;
  if (rawPayload == null || typeof rawPayload !== "object") {
    throw new AiMemberActionValidationError("적용할 승인 결과(payload)가 없습니다.");
  }
  const resultPayload = rawPayload as Record<string, unknown>;

  const auditBase = toAuditBase(row, "APPLY", "AI 승인 결과 적용");

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const failed = await prisma.projectMemberAction.update({
      where: { id: row.id },
      data: {
        applyStatus: "APPLY_FAILED",
      },
      include: {
        projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
      },
    });
    await auditAiMemberActionApplyFailed(auditBase, actorUserId, msg);
    return failed;
  }

  const updated = await prisma.projectMemberAction.update({
    where: { id: row.id },
    data: {
      applyStatus: "APPLIED",
      appliedAt: new Date(),
      appliedByUserId: actorUserId,
    },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  await auditAiMemberActionApplied(toAuditBase(updated, "APPLIED", "AI 승인 결과 시스템 반영 완료"), actorUserId);
  return updated;
}

export async function listReviewHistory(actionId: string, actorUserId: string) {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    select: { projectId: true },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await requireProjectPermission(row.projectId, actorUserId, "canViewProject", "listReviewHistory");

  return prisma.aiMemberActionReviewLog.findMany({
    where: { actionId },
    orderBy: { createdAt: "asc" },
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
}
