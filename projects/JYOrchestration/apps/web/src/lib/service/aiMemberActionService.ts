import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type {
  AiMemberActionExecutionModeId,
  AiMemberActionStatusId,
  AiMemberActionTypeId,
} from "@/lib/ai-member/aiMemberActionTypes";
import {
  auditAiMemberActionCompletedByUser,
  auditAiMemberActionFailedByUser,
  auditAiMemberActionRequested,
} from "@/lib/ai-member/aiMemberActionAudit";
import {
  claimAiMemberActionById,
  dispatchClaimedAiMemberAction,
} from "@/lib/ai-member/aiMemberActionDispatcher";
import { requireProjectPermission, getUserProjectRole } from "@/lib/auth/rbacGuard";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

export class AiMemberActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiMemberActionValidationError";
  }
}

function permissionForCreate(actionType: AiMemberActionTypeId): "canRequestAiReviewAction" | "canRequestAiMemberAction" {
  return actionType === "REVIEW_REQUEST" ? "canRequestAiReviewAction" : "canRequestAiMemberAction";
}

async function requireCreatePermission(projectId: string, userId: string, actionType: AiMemberActionTypeId, context: string) {
  await requireProjectPermission(projectId, userId, permissionForCreate(actionType), context);
}

export async function requireDispatchAiMemberActionPermission(projectId: string, userId: string, context: string) {
  await requireProjectPermission(projectId, userId, "canDispatchAiMemberAction", context);
}

async function assertCanPatchAction(
  projectId: string,
  userId: string,
  row: { requestedByUserId: string; actionType: AiMemberActionTypeId }
) {
  await requireProjectPermission(projectId, userId, "canViewProject", "patch member action");
  const role = await getUserProjectRole(projectId, userId);
  if (!role) {
    throw new ProjectAccessDeniedError("프로젝트 접근 권한이 없습니다.");
  }
  if (role === "VIEWER") {
    throw new ProjectAccessDeniedError("이 액션을 수정할 권한이 없습니다.");
  }
  if (row.requestedByUserId === userId) {
    if (role === "REVIEWER" && row.actionType !== "REVIEW_REQUEST") {
      throw new ProjectAccessDeniedError("이 액션을 수정할 권한이 없습니다.");
    }
    return;
  }
  if (role === "OWNER" || role === "EDITOR") {
    return;
  }
  if (role === "REVIEWER") {
    throw new ProjectAccessDeniedError("이 액션을 수정할 권한이 없습니다.");
  }
  throw new ProjectAccessDeniedError("이 액션을 수정할 권한이 없습니다.");
}

async function assertTargetMember(projectId: string, projectMemberId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { id: projectMemberId, projectId },
    select: { id: true, memberType: true },
  });
  if (!member) {
    throw new AiMemberActionValidationError("대상 멤버를 찾을 수 없거나 프로젝트에 속하지 않습니다.");
  }
  if (member.memberType !== "AI") {
    throw new AiMemberActionValidationError("AI 멤버에게만 액션을 요청할 수 있습니다.");
  }
}

async function validateTargetRefs(
  projectId: string,
  input: {
    taskId?: string | null;
    taskPromptId?: string | null;
    taskRunId?: string | null;
    gitChangeRequestId?: string | null;
  }
) {
  let effectiveTaskId: string | null = input.taskId?.trim() || null;

  if (input.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: input.taskId, projectId },
      select: { id: true },
    });
    if (!task) {
      throw new AiMemberActionValidationError("taskId가 해당 프로젝트에 없습니다.");
    }
  }

  if (input.taskPromptId) {
    const prompt = await prisma.taskPrompt.findFirst({
      where: { id: input.taskPromptId, projectId },
      select: { id: true, taskId: true },
    });
    if (!prompt) {
      throw new AiMemberActionValidationError("taskPromptId가 해당 프로젝트에 없습니다.");
    }
    if (effectiveTaskId && prompt.taskId !== effectiveTaskId) {
      throw new AiMemberActionValidationError("taskPrompt가 지정한 taskId와 일치하지 않습니다.");
    }
    if (!effectiveTaskId) {
      effectiveTaskId = prompt.taskId;
    }
  }

  if (input.taskRunId) {
    const run = await prisma.taskRun.findFirst({
      where: { id: input.taskRunId },
      select: { id: true, taskId: true, taskPromptId: true, task: { select: { projectId: true } } },
    });
    if (!run || run.task.projectId !== projectId) {
      throw new AiMemberActionValidationError("taskRunId가 해당 프로젝트에 없습니다.");
    }
    if (effectiveTaskId && run.taskId !== effectiveTaskId) {
      throw new AiMemberActionValidationError("taskRun이 지정한 taskId와 일치하지 않습니다.");
    }
    if (!effectiveTaskId) {
      effectiveTaskId = run.taskId;
    }
    if (input.taskPromptId && run.taskPromptId !== input.taskPromptId) {
      throw new AiMemberActionValidationError("taskRun이 지정한 taskPrompt와 일치하지 않습니다.");
    }
  }

  if (input.gitChangeRequestId) {
    const gcr = await prisma.gitChangeRequest.findFirst({
      where: { id: input.gitChangeRequestId, projectId },
      select: { id: true, taskId: true, taskRunId: true },
    });
    if (!gcr) {
      throw new AiMemberActionValidationError("gitChangeRequestId가 해당 프로젝트에 없습니다.");
    }
    if (effectiveTaskId && gcr.taskId !== effectiveTaskId) {
      throw new AiMemberActionValidationError("Git 변경 요청의 task와 일치하지 않습니다.");
    }
    if (!effectiveTaskId) {
      effectiveTaskId = gcr.taskId;
    }
    if (input.taskRunId && gcr.taskRunId !== input.taskRunId) {
      throw new AiMemberActionValidationError("Git 변경 요청의 taskRun과 일치하지 않습니다.");
    }
  }
}

export function auditPayloadFromRow(
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
) {
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

export type CreateAiMemberActionInput = {
  projectId: string;
  projectMemberId: string;
  actionType: AiMemberActionTypeId;
  taskId?: string | null;
  taskPromptId?: string | null;
  taskRunId?: string | null;
  gitChangeRequestId?: string | null;
  requestPayload?: Prisma.InputJsonValue | null;
  executionMode?: AiMemberActionExecutionModeId | null;
  providerKey?: string | null;
  correlationKey?: string | null;
  requestedByUserId: string;
};

export async function createAiMemberAction(input: CreateAiMemberActionInput) {
  await requireCreatePermission(
    input.projectId,
    input.requestedByUserId,
    input.actionType,
    "aiMemberActionService.createAiMemberAction"
  );
  await assertTargetMember(input.projectId, input.projectMemberId);
  await validateTargetRefs(input.projectId, {
    taskId: input.taskId,
    taskPromptId: input.taskPromptId,
    taskRunId: input.taskRunId,
    gitChangeRequestId: input.gitChangeRequestId,
  });

  const mode = input.executionMode ?? "STUB";
  const correlationKey =
    input.correlationKey?.trim() ||
    `${input.projectId}:${input.actionType}:${input.taskId ?? ""}:${input.gitChangeRequestId ?? ""}:${randomUUID().slice(0, 8)}`;

  const created = await prisma.projectMemberAction.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId?.trim() || null,
      taskPromptId: input.taskPromptId?.trim() || null,
      taskRunId: input.taskRunId?.trim() || null,
      gitChangeRequestId: input.gitChangeRequestId?.trim() || null,
      projectMemberId: input.projectMemberId,
      actionType: input.actionType,
      status: "REQUESTED",
      requestPayload: input.requestPayload ?? undefined,
      executionMode: mode,
      providerKey: input.providerKey?.trim() || null,
      correlationKey,
      requestedByUserId: input.requestedByUserId,
    },
  });

  const row = await prisma.projectMemberAction.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  await auditAiMemberActionRequested({
    ...auditPayloadFromRow(
      row,
      row.projectMember,
      "REQUESTED",
      `AI 멤버 액션 요청: ${row.actionType}`
    ),
    actorUserId: input.requestedByUserId,
  });

  return row;
}

export async function listAiMemberActionsByProject(projectId: string, actorUserId: string) {
  await requireProjectPermission(projectId, actorUserId, "canViewProject", "aiMemberActionService.listByProject");
  return prisma.projectMemberAction.findMany({
    where: { projectId },
    orderBy: { requestedAt: "desc" },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}

export async function listAiMemberActionsByTask(taskId: string, actorUserId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) {
    throw new AiMemberActionValidationError("Task를 찾을 수 없습니다.");
  }
  await requireProjectPermission(task.projectId, actorUserId, "canViewProject", "aiMemberActionService.listByTask");
  return prisma.projectMemberAction.findMany({
    where: {
      projectId: task.projectId,
      OR: [
        { taskId },
        { taskPrompt: { taskId } },
        { taskRun: { taskId } },
        { gitChangeRequest: { taskId } },
      ],
    },
    orderBy: { requestedAt: "desc" },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}

export async function listAiMemberActionsByGitChangeRequest(gitChangeRequestId: string, actorUserId: string) {
  const gcr = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: { projectId: true },
  });
  if (!gcr) {
    throw new AiMemberActionValidationError("Git 변경 요청을 찾을 수 없습니다.");
  }
  await requireProjectPermission(gcr.projectId, actorUserId, "canViewProject", "aiMemberActionService.listByGit");
  return prisma.projectMemberAction.findMany({
    where: { projectId: gcr.projectId, gitChangeRequestId },
    orderBy: { requestedAt: "desc" },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}

export async function getAiMemberActionById(actionId: string, actorUserId: string) {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await requireProjectPermission(row.projectId, actorUserId, "canViewProject", "aiMemberActionService.getById");
  return row;
}

export async function updateAiMemberActionStatus(input: {
  actionId: string;
  actorUserId: string;
  status: AiMemberActionStatusId;
  resultPayload?: Prisma.InputJsonValue | null;
  errorMessage?: string | null;
  executionMode?: AiMemberActionExecutionModeId | null;
}) {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: input.actionId },
    include: {
      projectMember: { select: { displayName: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await assertCanPatchAction(row.projectId, input.actorUserId, {
    requestedByUserId: row.requestedByUserId,
    actionType: row.actionType as AiMemberActionTypeId,
  });

  const now = new Date();

  const data: Prisma.ProjectMemberActionUpdateInput = {
    status: input.status,
    resultPayload: input.resultPayload ?? undefined,
    errorMessage: input.errorMessage ?? undefined,
    consumedBy: input.status === "DONE" || input.status === "FAILED" || input.status === "CANCELED" ? null : undefined,
  };
  if (input.executionMode) {
    data.executionMode = input.executionMode;
  }
  if (input.status === "IN_PROGRESS" && !row.startedAt) {
    data.startedAt = now;
  }
  if (input.status === "FAILED") {
    data.lastError = input.errorMessage ?? undefined;
    data.retryCount = { increment: 1 };
  }
  if (input.status === "DONE" || input.status === "FAILED" || input.status === "CANCELED") {
    data.finishedAt = now;
  }

  if (input.status === "DONE") {
    data.reviewStatus = "PENDING_REVIEW";
    data.reviewedBy = { disconnect: true };
    data.reviewedAt = null;
    data.reviewComment = null;
    data.approvedPayload = Prisma.DbNull;
    data.applyStatus = "NOT_APPLIED";
    data.appliedAt = null;
    data.appliedBy = { disconnect: true };
  }
  if (input.status === "FAILED" || input.status === "CANCELED") {
    data.reviewStatus = null;
    data.reviewedBy = { disconnect: true };
    data.reviewedAt = null;
    data.reviewComment = null;
    data.approvedPayload = Prisma.DbNull;
    data.applyStatus = "NOT_APPLIED";
    data.appliedAt = null;
    data.appliedBy = { disconnect: true };
  }

  const updated = await prisma.projectMemberAction.update({
    where: { id: input.actionId },
    data,
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  const auditBase = auditPayloadFromRow(
    updated,
    updated.projectMember,
    input.status,
    input.status === "DONE"
      ? `AI 멤버 액션 수동 완료: ${updated.actionType}`
      : input.status === "FAILED"
        ? `AI 멤버 액션 수동 실패: ${updated.actionType}`
        : input.status
  );

  if (input.status === "DONE") {
    await auditAiMemberActionCompletedByUser(auditBase, input.actorUserId);
  }
  if (input.status === "FAILED") {
    await auditAiMemberActionFailedByUser(auditBase, input.actorUserId);
  }

  return updated;
}

export async function completeAiMemberAction(input: {
  actionId: string;
  actorUserId: string;
  resultPayload?: Prisma.InputJsonValue | null;
}) {
  return updateAiMemberActionStatus({
    actionId: input.actionId,
    actorUserId: input.actorUserId,
    status: "DONE",
    resultPayload: input.resultPayload ?? { stub: true, message: "수동 완료(STUB)" },
    errorMessage: null,
  });
}

export async function failAiMemberAction(input: {
  actionId: string;
  actorUserId: string;
  errorMessage: string;
  resultPayload?: Prisma.InputJsonValue | null;
}) {
  return updateAiMemberActionStatus({
    actionId: input.actionId,
    actorUserId: input.actorUserId,
    status: "FAILED",
    errorMessage: input.errorMessage,
    resultPayload: input.resultPayload ?? undefined,
  });
}

/** StubExecutor + ingestion + 감사(디스패처 경로) */
export async function runStubPipelineForUser(actionId: string, actorUserId: string) {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    include: {
      projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await assertCanPatchAction(row.projectId, actorUserId, {
    requestedByUserId: row.requestedByUserId,
    actionType: row.actionType as AiMemberActionTypeId,
  });

  const tag = `user:${actorUserId}`;
  let working = row;
  if (row.status === "REQUESTED") {
    const claimed = await claimAiMemberActionById(actionId, tag);
    if (!claimed) {
      throw new AiMemberActionValidationError("액션을 클레임할 수 없습니다. 다른 워커가 처리 중일 수 있습니다.");
    }
    working = claimed;
  }

  if (working.status !== "IN_PROGRESS") {
    throw new AiMemberActionValidationError("REQUESTED 또는 IN_PROGRESS 상태에서만 스텁 파이프라인을 실행할 수 있습니다.");
  }

  await prisma.projectMemberAction.update({
    where: { id: actionId },
    data: { executionMode: "STUB" },
  });

  const fresh = await prisma.projectMemberAction.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
    },
  });

  await dispatchClaimedAiMemberAction(fresh, tag);
  return prisma.projectMemberAction.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}

export async function dispatchAiMemberActionForUser(actionId: string, actorUserId: string) {
  const row = await prisma.projectMemberAction.findUnique({
    where: { id: actionId },
    include: {
      projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
    },
  });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  await requireDispatchAiMemberActionPermission(row.projectId, actorUserId, "aiMemberActionService.dispatchForUser");
  if (row.status !== "REQUESTED") {
    throw new AiMemberActionValidationError("REQUESTED 상태의 액션만 디스패치할 수 있습니다.");
  }
  const tag = `user-dispatch:${actorUserId}`;
  const claimed = await claimAiMemberActionById(actionId, tag);
  if (!claimed) {
    throw new AiMemberActionValidationError("액션을 클레임할 수 없습니다.");
  }
  await dispatchClaimedAiMemberAction(claimed, tag);
  return prisma.projectMemberAction.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}

/** FAILED → REQUESTED 재큐(OWNER/EDITOR) */
export async function retryAiMemberActionRequest(actionId: string, actorUserId: string) {
  const row = await prisma.projectMemberAction.findUnique({ where: { id: actionId } });
  if (!row) {
    throw new AiMemberActionValidationError("액션을 찾을 수 없습니다.");
  }
  const role = await getUserProjectRole(row.projectId, actorUserId);
  if (role !== "OWNER" && role !== "EDITOR") {
    throw new ProjectAccessDeniedError("재시도 큐잉은 OWNER/EDITOR만 가능합니다.");
  }
  await requireProjectPermission(row.projectId, actorUserId, "canViewProject", "retryAiMemberAction");
  if (row.status !== "FAILED" && row.status !== "CANCELED") {
    throw new AiMemberActionValidationError("FAILED 또는 CANCELED 액션만 다시 요청할 수 있습니다.");
  }
  await prisma.projectMemberAction.update({
    where: { id: actionId },
    data: {
      status: "REQUESTED",
      consumedBy: null,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      lastError: null,
      availableAt: null,
      resultPayload: Prisma.DbNull,
      reviewStatus: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewComment: null,
      approvedPayload: Prisma.DbNull,
      applyStatus: "NOT_APPLIED",
      appliedAt: null,
      appliedByUserId: null,
    },
  });
  return prisma.projectMemberAction.findUniqueOrThrow({
    where: { id: actionId },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });
}
