import type { Prisma } from "@prisma/client";
import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import { prisma } from "@/lib/prisma";
import type { ImplementationRuntimeCodeTaskQueueItemView } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";
import {
  resolveNoCodeChangeEvidence,
  resolveQueueItemStatusAfterGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueuePolicy";
import {
  isImplementationRuntimeQueueItemInFlight,
  isImplementationRuntimeQueueItemTerminal,
  type ImplementationRuntimeCodeTaskQueueItemStatus,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";

function mapRow(row: {
  id: string;
  projectId: string;
  jobId: string;
  queueOrder: number;
  codeTaskId: string;
  parentTaskId: string;
  workItemId: string | null;
  status: string;
  attemptNo: number;
  commitSha: string | null;
  failureReason: string | null;
  updatedAt: Date;
}): ImplementationRuntimeCodeTaskQueueItemView {
  return {
    id: row.id,
    projectId: row.projectId,
    jobId: row.jobId,
    queueOrder: row.queueOrder,
    codeTaskId: row.codeTaskId,
    parentTaskId: row.parentTaskId,
    workItemId: row.workItemId,
    status: row.status as ImplementationRuntimeCodeTaskQueueItemStatus,
    attemptNo: row.attemptNo,
    commitSha: row.commitSha,
    failureReason: row.failureReason,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export {
  canCompleteQueueItemFromGithubVerify,
  resolveNoCodeChangeEvidence,
  resolveQueueItemStatusAfterGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueuePolicy";

export async function createImplementationRuntimeCodeTaskQueue(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly items: readonly {
    readonly codeTaskId: string;
    readonly parentTaskId: string;
    readonly workItemId?: string | null;
    readonly queueOrder: number;
  }[];
  readonly now?: Date;
}): Promise<readonly ImplementationRuntimeCodeTaskQueueItemView[]> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  if (!pid || !jobId) throw new Error("projectId and jobId are required");
  const items = input.items.map((item) => ({
    codeTaskId: item.codeTaskId.trim(),
    parentTaskId: item.parentTaskId.trim() || item.codeTaskId.trim(),
    workItemId: item.workItemId?.trim() || null,
    queueOrder: item.queueOrder,
  }));
  if (!items.length) throw new Error("queue items are required");

  const existing = await prisma.implementationRuntimeCodeTaskQueueItem.count({
    where: { jobId },
  });
  if (existing > 0) {
    return getImplementationRuntimeCodeTaskQueue(jobId);
  }

  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.implementationRuntimeCodeTaskQueueItem.create({
        data: {
          projectId: pid,
          jobId,
          queueOrder: item.queueOrder,
          codeTaskId: item.codeTaskId,
          parentTaskId: item.parentTaskId,
          workItemId: item.workItemId,
          status: "queued",
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    await tx.implementationRuntimeEvent.create({
      data: {
        projectId: pid,
        jobId,
        eventType: "queue_created",
        payloadJson: {
          count: items.length,
          codeTaskIds: items.map((i) => i.codeTaskId),
        } as Prisma.InputJsonValue,
      },
    });
  });

  return getImplementationRuntimeCodeTaskQueue(jobId);
}

export async function getImplementationRuntimeCodeTaskQueue(
  jobId: string,
): Promise<readonly ImplementationRuntimeCodeTaskQueueItemView[]> {
  const rows = await prisma.implementationRuntimeCodeTaskQueueItem.findMany({
    where: { jobId: jobId.trim() },
    orderBy: { queueOrder: "asc" },
  });
  return rows.map(mapRow);
}

export async function getCurrentImplementationRuntimeCodeTaskQueueItem(
  jobId: string,
): Promise<ImplementationRuntimeCodeTaskQueueItemView | null> {
  const job = await prisma.implementationExecutionJob.findFirst({
    where: { id: jobId.trim() },
  });
  const currentCodeTaskId = job?.currentCodeTaskId?.trim() ?? "";
  const items = await getImplementationRuntimeCodeTaskQueue(jobId);
  if (!items.length) return null;
  if (currentCodeTaskId) {
    const match = items.find((i) => i.codeTaskId === currentCodeTaskId);
    if (match) return match;
  }
  return (
    items.find((i) => !isImplementationRuntimeQueueItemTerminal(i.status)) ??
    items[items.length - 1] ??
    null
  );
}

async function updateQueueItemStatus(input: {
  readonly itemId: string;
  readonly status: ImplementationRuntimeCodeTaskQueueItemStatus;
  readonly patch?: Partial<{
    readonly cursorRequestId: string | null;
    readonly cursorRunId: string | null;
    readonly targetRepository: string | null;
    readonly baseBranch: string | null;
    readonly workBranch: string | null;
    readonly commitSha: string | null;
    readonly branchHeadCommitSha: string | null;
    readonly changedFilesJson: Prisma.InputJsonValue;
    readonly noCodeChangeEvidence: string | null;
    readonly failureReason: string | null;
    readonly errorMessage: string | null;
    readonly dispatchedAt: Date;
    readonly githubVerifiedAt: Date;
    readonly completedAt: Date;
  }>;
  readonly now?: Date;
}): Promise<ImplementationRuntimeCodeTaskQueueItemView> {
  const now = input.now ?? new Date();
  const row = await prisma.implementationRuntimeCodeTaskQueueItem.update({
    where: { id: input.itemId.trim() },
    data: {
      status: input.status,
      updatedAt: now,
      ...(input.patch?.cursorRequestId !== undefined
        ? { cursorRequestId: input.patch.cursorRequestId }
        : {}),
      ...(input.patch?.cursorRunId !== undefined ? { cursorRunId: input.patch.cursorRunId } : {}),
      ...(input.patch?.targetRepository !== undefined
        ? { targetRepository: input.patch.targetRepository }
        : {}),
      ...(input.patch?.baseBranch !== undefined ? { baseBranch: input.patch.baseBranch } : {}),
      ...(input.patch?.workBranch !== undefined ? { workBranch: input.patch.workBranch } : {}),
      ...(input.patch?.commitSha !== undefined ? { commitSha: input.patch.commitSha } : {}),
      ...(input.patch?.branchHeadCommitSha !== undefined
        ? { branchHeadCommitSha: input.patch.branchHeadCommitSha }
        : {}),
      ...(input.patch?.changedFilesJson !== undefined
        ? { changedFilesJson: input.patch.changedFilesJson }
        : {}),
      ...(input.patch?.noCodeChangeEvidence !== undefined
        ? { noCodeChangeEvidence: input.patch.noCodeChangeEvidence }
        : {}),
      ...(input.patch?.failureReason !== undefined ? { failureReason: input.patch.failureReason } : {}),
      ...(input.patch?.errorMessage !== undefined ? { errorMessage: input.patch.errorMessage } : {}),
      ...(input.patch?.dispatchedAt ? { dispatchedAt: input.patch.dispatchedAt } : {}),
      ...(input.patch?.githubVerifiedAt ? { githubVerifiedAt: input.patch.githubVerifiedAt } : {}),
      ...(input.patch?.completedAt ? { completedAt: input.patch.completedAt } : {}),
    },
  });
  return mapRow(row);
}

export async function markImplementationRuntimeCodeTaskQueueItemDispatching(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly now?: Date;
}): Promise<ImplementationRuntimeCodeTaskQueueItemView | null> {
  const jobId = input.jobId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const now = input.now ?? new Date();
  const updated = await prisma.implementationRuntimeCodeTaskQueueItem.updateMany({
    where: { jobId, codeTaskId, status: "queued" },
    data: { status: "dispatching", dispatchedAt: now, updatedAt: now },
  });
  if (updated.count === 1) {
    const row = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
      where: { jobId, codeTaskId },
    });
    return row ? mapRow(row) : null;
  }
  const item = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
    where: { jobId, codeTaskId },
  });
  if (!item) return null;
  if (isImplementationRuntimeQueueItemInFlight(item.status)) {
    throw new Error(`Duplicate dispatch blocked: queue item ${item.status}`);
  }
  if (isImplementationRuntimeQueueItemTerminal(item.status)) {
    throw new Error(`Dispatch blocked: queue item terminal (${item.status})`);
  }
  throw new Error(`Dispatch only allowed from queued (status=${item.status})`);
}

export async function markImplementationRuntimeCodeTaskQueueItemCursorRequested(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly cursorRequestId?: string | null;
  readonly cursorRunId?: string | null;
  readonly targetRepository?: string | null;
  readonly baseBranch?: string | null;
  readonly workBranch?: string | null;
  readonly now?: Date;
}): Promise<ImplementationRuntimeCodeTaskQueueItemView | null> {
  const item = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
    where: { jobId: input.jobId.trim(), codeTaskId: input.codeTaskId.trim() },
  });
  if (!item) return null;
  return updateQueueItemStatus({
    itemId: item.id,
    status: "cursor_running",
    patch: {
      cursorRequestId: input.cursorRequestId ?? input.cursorRunId ?? null,
      cursorRunId: input.cursorRunId ?? null,
      targetRepository: input.targetRepository ?? null,
      baseBranch: input.baseBranch ?? null,
      workBranch: input.workBranch ?? null,
    },
    now: input.now,
  });
}

export async function applyGithubVerifyToImplementationRuntimeCodeTaskQueueItem(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly verify: TaskCursorGithubVerifyResult;
  readonly now?: Date;
}): Promise<ImplementationRuntimeCodeTaskQueueItemView | null> {
  const item = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
    where: { jobId: input.jobId.trim(), codeTaskId: input.codeTaskId.trim() },
  });
  if (!item) return null;
  const now = input.now ?? new Date();
  const status = resolveQueueItemStatusAfterGithubVerify({ verify: input.verify });
  const noCodeEvidence = resolveNoCodeChangeEvidence(input.verify);
  const changedFiles = input.verify.verifiedChangedFiles ?? [];
  return updateQueueItemStatus({
    itemId: item.id,
    status,
    patch: {
      commitSha: input.verify.verifiedCommitSha ?? null,
      branchHeadCommitSha: input.verify.verifiedCommitSha ?? null,
      changedFilesJson: changedFiles.length ? (changedFiles as Prisma.InputJsonValue) : undefined,
      noCodeChangeEvidence: noCodeEvidence,
      failureReason:
        status === "failed" || status === "rework_required"
          ? input.verify.message ?? input.verify.reason ?? "github_verify_failed"
          : null,
      errorMessage:
        status === "failed" ? input.verify.message ?? input.verify.reason ?? null : null,
      githubVerifiedAt: now,
      completedAt: isImplementationRuntimeQueueItemTerminal(status) ? now : undefined,
    },
    now,
  });
}

export async function advanceImplementationRuntimeCodeTaskQueue(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly stopOnFailure?: boolean;
  readonly now?: Date;
}): Promise<{
  readonly advanced: boolean;
  readonly nextCodeTaskId: string | null;
  readonly jobCompleted: boolean;
}> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.implementationExecutionJob.findFirst({
      where: { id: jobId, projectId: pid },
    });
    if (!job || job.status !== "running") {
      return { advanced: false, nextCodeTaskId: null, jobCompleted: false };
    }

    const items = await tx.implementationRuntimeCodeTaskQueueItem.findMany({
      where: { jobId },
      orderBy: { queueOrder: "asc" },
    });
    if (!items.length) {
      return { advanced: false, nextCodeTaskId: null, jobCompleted: false };
    }

    const currentId = job.currentCodeTaskId?.trim() ?? "";
    const currentIdx = items.findIndex((i) => i.codeTaskId === currentId);
    const currentItem = currentIdx >= 0 ? items[currentIdx] : null;
    if (currentItem && !isImplementationRuntimeQueueItemTerminal(currentItem.status)) {
      return { advanced: false, nextCodeTaskId: currentId, jobCompleted: false };
    }

    if (
      currentItem &&
      (currentItem.status === "failed" || currentItem.status === "rework_required") &&
      input.stopOnFailure !== false
    ) {
      await tx.implementationExecutionJob.update({
        where: { id: jobId },
        data: { status: "paused", failureReason: currentItem.failureReason, updatedAt: now },
      });
      return { advanced: false, nextCodeTaskId: null, jobCompleted: false };
    }

    const nextItem = items.find(
      (i, idx) =>
        idx > (currentIdx < 0 ? -1 : currentIdx) && i.status === "queued",
    );
    if (!nextItem) {
      const allTerminal = items.every((i) => isImplementationRuntimeQueueItemTerminal(i.status));
      if (allTerminal) {
        const hasIssue = items.some(
          (i) => i.status === "failed" || i.status === "rework_required",
        );
        const allCompleted = items.every(
          (i) => i.status === "completed" || i.status === "no_code_change_completed",
        );
        const status = allCompleted && !hasIssue ? "completed" : hasIssue ? "completed_with_issues" : "failed";
        await tx.implementationExecutionJob.update({
          where: { id: jobId },
          data: { status, completedAt: now, updatedAt: now },
        });
        return { advanced: false, nextCodeTaskId: null, jobCompleted: true };
      }
      return { advanced: false, nextCodeTaskId: null, jobCompleted: false };
    }

    await tx.implementationExecutionJob.update({
      where: { id: jobId },
      data: { currentCodeTaskId: nextItem.codeTaskId, updatedAt: now },
    });

    const existingRun = await tx.implementationCodeTaskRun.findFirst({
      where: { jobId, codeTaskId: nextItem.codeTaskId },
    });
    if (!existingRun) {
      await tx.implementationCodeTaskRun.create({
        data: {
          projectId: pid,
          jobId,
          codeTaskId: nextItem.codeTaskId,
          runtimeState: "queued",
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
    }

    return { advanced: true, nextCodeTaskId: nextItem.codeTaskId, jobCompleted: false };
  });
}

export async function assertQueueItemDispatchAllowed(input: {
  readonly jobId: string;
  readonly codeTaskId: string;
}): Promise<void> {
  const item = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
    where: { jobId: input.jobId.trim(), codeTaskId: input.codeTaskId.trim() },
  });
  if (!item) return;
  if (isImplementationRuntimeQueueItemInFlight(item.status)) {
    throw new Error(`Duplicate dispatch blocked: queue item ${item.status}`);
  }
  if (isImplementationRuntimeQueueItemTerminal(item.status)) {
    throw new Error(`Dispatch blocked: queue item terminal (${item.status})`);
  }
  if (item.status !== "queued") {
    throw new Error(`Dispatch only allowed from queued (status=${item.status})`);
  }
}

export async function syncQueueItemsForJobStart(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly resolveMeta?: (codeTaskId: string) => {
    readonly parentTaskId: string;
    readonly workItemId?: string | null;
  };
}): Promise<readonly ImplementationRuntimeCodeTaskQueueItemView[]> {
  const items = input.selectedCodeTaskIds.map((codeTaskId, queueOrder) => {
    const meta = input.resolveMeta?.(codeTaskId);
    return {
      codeTaskId,
      parentTaskId: meta?.parentTaskId?.trim() || codeTaskId,
      workItemId: meta?.workItemId ?? null,
      queueOrder,
    };
  });
  return createImplementationRuntimeCodeTaskQueue({
    projectId: input.projectId,
    jobId: input.jobId,
    items,
  });
}
