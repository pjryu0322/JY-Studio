import type { Prisma } from "@prisma/client";
import {
  auditAiMemberActionAwaitingManual,
  auditAiMemberActionCompleted,
  auditAiMemberActionFailed,
  auditAiMemberActionStarted,
} from "@/lib/ai-member/aiMemberActionAudit";
import type { ActionForExecution } from "@/lib/ai-member/executors/types";
import { selectExecutorForMode } from "@/lib/ai-member/executors";
import { processReviewAndOptionalAutoApplyAfterDone } from "@/lib/ai-member/aiMemberActionCompletion";
import { prisma } from "@/lib/prisma";

const MAX_BACKOFF_MS = 30_000;

export type ClaimedMemberAction = Prisma.ProjectMemberActionGetPayload<{
  include: {
    projectMember: { select: { displayName: true; aiProvider: true; aiAgentKey: true } };
  };
}>;

function toExecutionPayload(row: ClaimedMemberAction): ActionForExecution {
  return {
    id: row.id,
    projectId: row.projectId,
    actionType: row.actionType,
    executionMode: row.executionMode,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    requestPayload: row.requestPayload,
    providerKey: row.providerKey,
    projectMember: row.projectMember,
  };
}

function auditBase(row: ClaimedMemberAction, status: string, summary: string) {
  return {
    projectId: row.projectId,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    actionId: row.id,
    actionType: row.actionType,
    projectMemberId: row.projectMemberId,
    aiDisplayName: row.projectMember.displayName,
    requestedByUserId: row.requestedByUserId,
    status,
    summary,
    detailJson: {
      actionId: row.id,
      actionType: row.actionType,
      projectMemberId: row.projectMemberId,
      executionMode: row.executionMode,
      providerKey: row.providerKey ?? null,
    },
  };
}

/**
 * 대기 중인 액션 1건을 원자적으로 IN_PROGRESS + consumedBy 로 클레임한다.
 */
export async function claimNextAiMemberActionForProject(
  projectId: string,
  consumedBy: string
): Promise<ClaimedMemberAction | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.projectMemberAction.findFirst({
      where: {
        projectId,
        status: "REQUESTED",
        consumedBy: null,
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
      orderBy: { requestedAt: "asc" },
      include: {
        projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
      },
    });
    if (!candidate) {
      return null;
    }
    const updated = await tx.projectMemberAction.updateMany({
      where: { id: candidate.id, status: "REQUESTED" },
      data: {
        status: "IN_PROGRESS",
        consumedBy,
        startedAt: candidate.startedAt ?? now,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    return tx.projectMemberAction.findUniqueOrThrow({
      where: { id: candidate.id },
      include: {
        projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
      },
    });
  });
}

export async function claimNextAiMemberAction(consumedBy: string): Promise<ClaimedMemberAction | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.projectMemberAction.findFirst({
      where: {
        status: "REQUESTED",
        consumedBy: null,
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
      orderBy: { requestedAt: "asc" },
      include: {
        projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
      },
    });
    if (!candidate) {
      return null;
    }
    const updated = await tx.projectMemberAction.updateMany({
      where: { id: candidate.id, status: "REQUESTED" },
      data: {
        status: "IN_PROGRESS",
        consumedBy,
        startedAt: candidate.startedAt ?? now,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    return tx.projectMemberAction.findUniqueOrThrow({
      where: { id: candidate.id },
      include: {
        projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
      },
    });
  });
}

export async function claimAiMemberActionById(
  actionId: string,
  consumedBy: string
): Promise<ClaimedMemberAction | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.projectMemberAction.updateMany({
      where: {
        id: actionId,
        status: "REQUESTED",
        consumedBy: null,
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
      data: {
        status: "IN_PROGRESS",
        consumedBy,
        startedAt: now,
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    return tx.projectMemberAction.findUniqueOrThrow({
      where: { id: actionId },
      include: {
        projectMember: { select: { displayName: true, aiProvider: true, aiAgentKey: true } },
      },
    });
  });
}

/**
 * 이미 클레임된 행에 대해 실행기를 돌리고 결과를 반영한다.
 */
export async function dispatchClaimedAiMemberAction(
  row: ClaimedMemberAction,
  consumedBy: string
): Promise<void> {
  await auditAiMemberActionStarted(auditBase(row, "IN_PROGRESS", "AI 멤버 액션 디스패치 시작"), {
    actorId: consumedBy,
  });

  const executor = selectExecutorForMode(row.executionMode);
  try {
    const out = await executor.execute(toExecutionPayload(row));

    if (out.keepInProgress) {
      await prisma.projectMemberAction.update({
        where: { id: row.id },
        data: {
          resultPayload: out.resultPayload as object,
          assignedExecutor: executor.name,
        },
      });
      await auditAiMemberActionAwaitingManual(
        auditBase(row, "IN_PROGRESS", out.summaryText ?? "수동 처리 대기"),
        { actorId: consumedBy }
      );
      return;
    }

    await prisma.projectMemberAction.update({
      where: { id: row.id },
      data: {
        status: "DONE",
        resultPayload: out.resultPayload as object,
        assignedExecutor: executor.name,
        finishedAt: new Date(),
        errorMessage: null,
        lastError: null,
        consumedBy: null,
      },
    });

    await auditAiMemberActionCompleted(
      auditBase(row, "DONE", out.summaryText ?? "AI 멤버 액션 완료"),
      { actorId: consumedBy }
    );

    await processReviewAndOptionalAutoApplyAfterDone(row.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.projectMemberAction.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: msg,
        lastError: msg,
        retryCount: { increment: 1 },
        availableAt: new Date(Date.now() + Math.min(5000 * (row.retryCount + 1), MAX_BACKOFF_MS)),
        consumedBy: null,
      },
    });
    await auditAiMemberActionFailed(
      auditBase(row, "FAILED", msg),
      { actorId: consumedBy }
    );
  }
}

export async function pollAiMemberActionsOnce(consumedBy: string): Promise<"claimed" | "idle"> {
  const row = await claimNextAiMemberAction(consumedBy);
  if (!row) {
    return "idle";
  }
  await dispatchClaimedAiMemberAction(row, consumedBy);
  return "claimed";
}

export async function pollAiMemberActionsOnceForProject(
  projectId: string,
  consumedBy: string
): Promise<"claimed" | "idle"> {
  const row = await claimNextAiMemberActionForProject(projectId, consumedBy);
  if (!row) {
    return "idle";
  }
  await dispatchClaimedAiMemberAction(row, consumedBy);
  return "claimed";
}

export function computeIdleSleepMs(streakIdle: number): number {
  const base = 800;
  const cap = 12_000;
  return Math.min(cap, base * Math.pow(1.4, Math.min(streakIdle, 12)));
}
