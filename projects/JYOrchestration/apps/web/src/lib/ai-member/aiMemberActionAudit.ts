import type { Prisma } from "@prisma/client";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

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

type AuditBase = {
  projectId: string;
  taskId: string | null;
  taskPromptId: string | null;
  taskRunId: string | null;
  gitChangeRequestId: string | null;
  actionId: string;
  actionType: string;
  projectMemberId: string;
  aiDisplayName: string | null;
  requestedByUserId: string;
  status: string;
  summary: string;
  detailJson: Prisma.InputJsonObject;
};

async function appendWithResolvedTask(
  input: AuditBase,
  actorType: string,
  actorId: string | null,
  eventType: string
) {
  let tid =
    input.taskId ??
    (await resolveTaskIdForAudit({
      taskId: input.taskId,
      taskPromptId: input.taskPromptId,
      taskRunId: input.taskRunId,
      gitChangeRequestId: input.gitChangeRequestId,
    }));
  if (!tid) {
    const anchor = await prisma.task.findFirst({
      where: { projectId: input.projectId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    tid = anchor?.id ?? null;
  }
  if (!tid) {
    return;
  }
  try {
    await appendTaskHistory({
      projectId: input.projectId,
      taskId: tid,
      actorType,
      actorId,
      eventType,
      summary: input.summary,
      detailJson: input.detailJson,
    });
  } catch {
    // best-effort
  }
}

export async function auditAiMemberActionRequested(input: AuditBase & { actorUserId: string }) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.USER,
    input.actorUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_REQUESTED
  );
}

export async function auditAiMemberActionStarted(input: AuditBase, opts?: { actorId?: string | null }) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.SYSTEM,
    opts?.actorId ?? null,
    TaskHistoryEventType.AI_MEMBER_ACTION_STARTED
  );
}

export async function auditAiMemberActionCompleted(input: AuditBase, opts?: { actorId?: string | null }) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.SYSTEM,
    opts?.actorId ?? null,
    TaskHistoryEventType.AI_MEMBER_ACTION_COMPLETED
  );
}

export async function auditAiMemberActionCompletedByUser(input: AuditBase, actorUserId: string) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.USER,
    actorUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_COMPLETED
  );
}

export async function auditAiMemberActionFailed(input: AuditBase, opts?: { actorId?: string | null }) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.SYSTEM,
    opts?.actorId ?? null,
    TaskHistoryEventType.AI_MEMBER_ACTION_FAILED
  );
}

export async function auditAiMemberActionFailedByUser(input: AuditBase, actorUserId: string) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.USER,
    actorUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_FAILED
  );
}

export async function auditAiMemberActionAwaitingManual(input: AuditBase, opts?: { actorId?: string | null }) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.SYSTEM,
    opts?.actorId ?? null,
    TaskHistoryEventType.AI_MEMBER_ACTION_AWAITING_MANUAL
  );
}

function eventForReviewDecision(decision: string): string {
  switch (decision) {
    case "APPROVE":
      return TaskHistoryEventType.AI_MEMBER_ACTION_APPROVED;
    case "REJECT":
      return TaskHistoryEventType.AI_MEMBER_ACTION_REJECTED;
    case "REQUEST_REVISION":
      return TaskHistoryEventType.AI_MEMBER_ACTION_NEEDS_REVISION;
    default:
      return TaskHistoryEventType.AI_MEMBER_ACTION_REVIEWED;
  }
}

export async function auditAiMemberActionReviewDecision(input: {
  base: AuditBase;
  reviewerUserId: string;
  decision: string;
  reviewComment: string | null;
}) {
  const detailJson: Prisma.InputJsonObject = {
    ...input.base.detailJson,
    reviewerUserId: input.reviewerUserId,
    decision: input.decision,
    reviewComment: input.reviewComment,
  };
  const base = { ...input.base, detailJson, summary: `AI 액션 검토: ${input.decision}` };
  await appendWithResolvedTask(
    base,
    TaskHistoryActorType.USER,
    input.reviewerUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_REVIEWED
  );
  await appendWithResolvedTask(
    base,
    TaskHistoryActorType.USER,
    input.reviewerUserId,
    eventForReviewDecision(input.decision)
  );
}

export async function auditAiMemberActionApplied(input: AuditBase, actorUserId: string) {
  await appendWithResolvedTask(
    input,
    TaskHistoryActorType.USER,
    actorUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_APPLIED
  );
}

export async function auditAiMemberActionApplyFailed(baseInput: AuditBase, actorUserId: string, errorMessage: string) {
  const detailJson: Prisma.InputJsonObject = {
    ...baseInput.detailJson,
    errorMessage,
  };
  await appendWithResolvedTask(
    { ...baseInput, detailJson, summary: `AI 승인 결과 적용 실패: ${errorMessage}` },
    TaskHistoryActorType.USER,
    actorUserId,
    TaskHistoryEventType.AI_MEMBER_ACTION_APPLY_FAILED
  );
}
