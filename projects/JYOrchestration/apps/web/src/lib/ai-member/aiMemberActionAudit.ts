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
  const tid =
    input.taskId ??
    (await resolveTaskIdForAudit({
      taskId: input.taskId,
      taskPromptId: input.taskPromptId,
      taskRunId: input.taskRunId,
      gitChangeRequestId: input.gitChangeRequestId,
    }));
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
