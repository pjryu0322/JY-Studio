import type { Prisma } from "@prisma/client";
import type {
  AiMemberActionExecutionModeId,
  AiMemberActionStatusId,
  AiMemberActionTypeId,
} from "@/lib/ai-member/aiMemberActionTypes";
import { requireProjectPermission, getUserProjectRole } from "@/lib/auth/rbacGuard";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

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

async function assertCanPatchAction(projectId: string, userId: string, row: { requestedByUserId: string; actionType: AiMemberActionTypeId }) {
  await requireProjectPermission(projectId, userId, "canViewProject", "patch member action");
  const role = await getUserProjectRole(projectId, userId);
  if (!role) {
    throw new ProjectAccessDeniedError("프로젝트 접근 권한이 없습니다.");
  }
  if (row.requestedByUserId === userId) {
    return;
  }
  if (role === "OWNER" || role === "EDITOR") {
    return;
  }
  if (role === "REVIEWER" && row.actionType === "REVIEW_REQUEST") {
    return;
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

async function resolveTaskIdForAudit(input: {
  taskId?: string | null;
  taskPromptId?: string | null;
  taskRunId?: string | null;
  gitChangeRequestId?: string | null;
}): Promise<string | null> {
  if (input.taskId) return input.taskId;
  if (input.taskPromptId) {
    const p = await prisma.taskPrompt.findUnique({
      where: { id: input.taskPromptId },
      select: { taskId: true },
    });
    return p?.taskId ?? null;
  }
  if (input.taskRunId) {
    const r = await prisma.taskRun.findUnique({
      where: { id: input.taskRunId },
      select: { taskId: true },
    });
    return r?.taskId ?? null;
  }
  if (input.gitChangeRequestId) {
    const g = await prisma.gitChangeRequest.findUnique({
      where: { id: input.gitChangeRequestId },
      select: { taskId: true },
    });
    return g?.taskId ?? null;
  }
  return null;
}

async function appendActionTaskHistory(input: {
  projectId: string;
  taskId: string | null;
  requestedByUserId: string;
  eventType: string;
  summary: string;
  detailJson: Prisma.InputJsonObject;
}) {
  if (!input.taskId) {
    return;
  }
  try {
    await appendTaskHistory({
      projectId: input.projectId,
      taskId: input.taskId,
      actorType: TaskHistoryActorType.USER,
      actorId: input.requestedByUserId,
      eventType: input.eventType,
      summary: input.summary,
      detailJson: input.detailJson,
    });
  } catch {
    // 감사 베스트 에포트
  }
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

  const row = await prisma.projectMemberAction.create({
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
      requestedByUserId: input.requestedByUserId,
    },
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  const auditTaskId = await resolveTaskIdForAudit({
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
  });

  await appendActionTaskHistory({
    projectId: row.projectId,
    taskId: auditTaskId,
    requestedByUserId: input.requestedByUserId,
    eventType: TaskHistoryEventType.ACTION_REQUESTED,
    summary: `멤버 액션 요청: ${row.actionType}`,
    detailJson: {
      actionId: row.id,
      actionType: row.actionType,
      projectMemberId: row.projectMemberId,
      executionMode: row.executionMode,
    },
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
  };
  if (input.executionMode) {
    data.executionMode = input.executionMode;
  }
  if (input.status === "IN_PROGRESS" && !row.startedAt) {
    data.startedAt = now;
  }
  if (input.status === "DONE" || input.status === "FAILED" || input.status === "CANCELED") {
    data.finishedAt = now;
  }

  const updated = await prisma.projectMemberAction.update({
    where: { id: input.actionId },
    data,
    include: {
      projectMember: { select: { id: true, displayName: true, memberType: true, role: true, aiProvider: true } },
    },
  });

  const auditTaskId = await resolveTaskIdForAudit({
    taskId: updated.taskId,
    taskPromptId: updated.taskPromptId,
    taskRunId: updated.taskRunId,
    gitChangeRequestId: updated.gitChangeRequestId,
  });

  if (input.status === "DONE") {
    await appendActionTaskHistory({
      projectId: updated.projectId,
      taskId: auditTaskId,
      requestedByUserId: input.actorUserId,
      eventType: TaskHistoryEventType.ACTION_COMPLETED,
      summary: `멤버 액션 완료: ${updated.actionType}`,
      detailJson: {
        actionId: updated.id,
        actionType: updated.actionType,
        projectMemberId: updated.projectMemberId,
      },
    });
  }
  if (input.status === "FAILED") {
    await appendActionTaskHistory({
      projectId: updated.projectId,
      taskId: auditTaskId,
      requestedByUserId: input.actorUserId,
      eventType: TaskHistoryEventType.ACTION_FAILED,
      summary: `멤버 액션 실패: ${updated.actionType}`,
      detailJson: {
        actionId: updated.id,
        actionType: updated.actionType,
        errorMessage: String(input.errorMessage ?? updated.errorMessage ?? ""),
      },
    });
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

/** STUB: 요청 직후 인진행 → 즉시 완료 더미 결과 */
export async function runStubAiMemberAction(actionId: string, actorUserId: string) {
  await updateAiMemberActionStatus({
    actionId,
    actorUserId,
    status: "IN_PROGRESS",
  });
  return completeAiMemberAction({
    actionId,
    actorUserId,
    resultPayload: { mode: "STUB", completedAt: new Date().toISOString(), note: "자동 스텁 완료" },
  });
}
