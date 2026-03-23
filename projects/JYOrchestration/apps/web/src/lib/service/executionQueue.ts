/**
 * DB 기반 실행 큐. 향후 Redis 등 외부 브로커로 교체 시 enqueue/claim 인터페이스만 유지.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ExecutionQueueJobType = "git-apply" | "pipeline" | "cursor";

export type ExecutionQueueJob = {
  id: string;
  projectId: string;
  type: ExecutionQueueJobType;
  payload: unknown;
  enqueuedAt: string;
};

export type EnqueueResult =
  | { queued: true; jobId: string }
  | { queued: false; reason: string };

export type ExecutionQueueStatusSnapshot = {
  pending: number;
  running: number;
  /** status=PENDING && availableAt > now */
  retryWaiting: number;
  failedRecent: number;
  mode: "db";
};

function logQueue(event: string, detail: Record<string, unknown>) {
  console.info("[execution-worker]", event, detail);
}

export async function enqueueExecution(input: {
  projectId: string;
  type: ExecutionQueueJobType;
  payload: Prisma.InputJsonValue;
}): Promise<EnqueueResult> {
  try {
    const row = await prisma.executionJob.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        status: "PENDING",
        payload: input.payload,
        availableAt: new Date(),
      },
      select: { id: true },
    });
    logQueue("enqueued", {
      jobId: row.id,
      projectId: input.projectId,
      type: input.type,
      retryCount: 0,
      attempt: 1,
    });
    return { queued: true, jobId: row.id };
  } catch (e) {
    console.error("enqueueExecution failed:", e);
    return {
      queued: false,
      reason: e instanceof Error ? e.message : "enqueue failed",
    };
  }
}

export async function getExecutionQueueStatus(projectId?: string): Promise<ExecutionQueueStatusSnapshot> {
  const now = new Date();
  const recentWindow = new Date(now.getTime() - 1000 * 60 * 60);
  const projectFilter = projectId ? { projectId } : {};
  const [pending, running, retryWaiting, failedRecent] = await Promise.all([
    prisma.executionJob.count({
      where: {
        ...projectFilter,
        status: "PENDING",
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
    }),
    prisma.executionJob.count({ where: { ...projectFilter, status: "RUNNING" } }),
    prisma.executionJob.count({
      where: { ...projectFilter, status: "PENDING", availableAt: { gt: now } },
    }),
    prisma.executionJob.count({
      where: { ...projectFilter, status: "FAILED", finishedAt: { gte: recentWindow } },
    }),
  ]);
  return { pending, running, retryWaiting, failedRecent, mode: "db" };
}
