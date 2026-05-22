/**
 * @deprecated Holder-job persistence for executionEventLog compat only.
 * Primary path: `createRuntimeEvent()` in runtimeEventRepository.ts.
 * Used when `RUNTIME_EVENT_COMPAT_EXECUTION_LOG=1` (default) and no executionJobId on the event.
 */

export function isRuntimeEventCompatExecutionLogEnabled(): boolean {
  return process.env.RUNTIME_EVENT_COMPAT_EXECUTION_LOG !== "0";
}

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RuntimeEventSeverity } from "@/lib/runtime/runtimeEventTypes";

const HOLDER_JOB_TYPE = "runtime-timeline";

export async function getOrCreateRuntimeTimelineHolderJobId(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
}): Promise<string> {
  const candidates = await prisma.executionJob.findMany({
    where: { projectId: input.projectId, type: HOLDER_JOB_TYPE, status: "DONE" },
    orderBy: { createdAt: "desc" },
    take: 32,
    select: { id: true, payload: true },
  });

  for (const row of candidates) {
    const payload = row.payload as { execRunId?: string } | null;
    if (payload?.execRunId === input.execRunId) {
      return row.id;
    }
  }

  const created = await prisma.executionJob.create({
    data: {
      projectId: input.projectId,
      type: HOLDER_JOB_TYPE,
      status: "DONE",
      payload: {
        execRunId: input.execRunId,
        taskId: input.taskId,
        holder: true,
      } as Prisma.InputJsonValue,
      finishedAt: new Date(),
      availableAt: new Date(),
    },
    select: { id: true },
  });

  return created.id;
}

export async function persistRuntimeEventToExecutionLog(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  eventType: string;
  severity: RuntimeEventSeverity;
  detail: Record<string, unknown>;
  workerName?: string | null;
}): Promise<void> {
  const executionJobId = await getOrCreateRuntimeTimelineHolderJobId({
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
  });

  const status = input.severity === "error" ? "FAILED" : "SUCCESS";
  await prisma.executionEventLog.create({
    data: {
      projectId: input.projectId,
      executionJobId,
      taskId: input.taskId,
      stage: "EXECUTE",
      status,
      message: input.eventType,
      detailJson: {
        ...input.detail,
        eventType: input.eventType,
        execRunId: input.execRunId,
        workerName: input.workerName ?? null,
        runtimeTimeline: true,
      } as Prisma.InputJsonValue,
    },
  });
}
