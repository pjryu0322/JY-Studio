import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AppendTaskHistoryInput = {
  projectId: string;
  taskId: string;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  summary?: string | null;
  detailJson?: Prisma.InputJsonValue | null;
};

export async function appendTaskHistory(input: AppendTaskHistoryInput) {
  return prisma.taskHistory.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary ?? null,
      detailJson: input.detailJson ?? undefined,
    },
  });
}

export async function listTaskHistoryByTaskId(taskId: string) {
  return prisma.taskHistory.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

/** Best-effort audit rows for Git apply; failures are logged, never thrown to callers. */
export async function appendGitApplyAuditTrail(input: {
  actorUserId: string;
  projectId: string;
  taskId: string;
  mode: string;
  isRetry: boolean;
  retryCountBeforeApply: number;
  lastErrorBeforeApply: string | null;
  afterRow: {
    applyStartedAt: Date | null;
    applyStatus: string | null;
    branchName: string | null;
    applyLog: string | null;
    retryCount: number;
    lastError: string | null;
  };
  applyOk: boolean;
  errorCode?: string;
}) {
  try {
    if (input.isRetry) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType: TaskHistoryActorType.USER,
        actorId: input.actorUserId,
        eventType: TaskHistoryEventType.RETRY_TRIGGERED,
        summary: "Git 반영 재시도",
        detailJson: {
          retryCount: input.retryCountBeforeApply,
          lastError: input.lastErrorBeforeApply,
        },
      });
    }

    if (input.afterRow.applyStartedAt) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType: TaskHistoryActorType.USER,
        actorId: input.actorUserId,
        eventType: TaskHistoryEventType.GIT_APPLY_STARTED,
        summary: "Git 반영 실행 시작",
        detailJson: {
          mode: input.mode,
          branchName: input.afterRow.branchName,
          applyStatus: input.afterRow.applyStatus,
        },
      });
    }

    if (input.applyOk) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType: TaskHistoryActorType.GIT,
        actorId: null,
        eventType: TaskHistoryEventType.GIT_APPLY_COMPLETED,
        summary: "Git 반영 완료",
        detailJson: {
          mode: input.mode,
          applyStatus: input.afterRow.applyStatus,
          branchName: input.afterRow.branchName,
          applyLogExists: Boolean(input.afterRow.applyLog),
        },
      });
    } else {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType: TaskHistoryActorType.GIT,
        actorId: null,
        eventType: TaskHistoryEventType.GIT_APPLY_FAILED,
        summary: "Git 반영 실패",
        detailJson: {
          mode: input.mode,
          applyStatus: input.afterRow.applyStatus,
          branchName: input.afterRow.branchName,
          lastError: input.afterRow.lastError,
          applyLogExists: Boolean(input.afterRow.applyLog),
          errorCode: input.errorCode ?? null,
        },
      });
    }
  } catch (error) {
    console.error("appendGitApplyAuditTrail failed:", error);
  }
}

export function serializeTaskHistoryRow(row: {
  id: string;
  projectId: string;
  taskId: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  summary: string | null;
  detailJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    actorType: row.actorType,
    actorId: row.actorId,
    eventType: row.eventType,
    summary: row.summary,
    detailJson: row.detailJson,
    createdAt: row.createdAt.toISOString(),
  };
}
