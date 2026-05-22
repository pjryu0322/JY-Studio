/**
 * RuntimeEvent table persistence (replaces holder-job as primary store).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RuntimeEventSeverity } from "@/lib/runtime/runtimeEventTypes";
import type { RuntimeTimelineRow } from "@/lib/runtime/runtimeObservability";

export type CreateRuntimeEventInput = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly executionJobId?: string | null;
  readonly eventType: string;
  readonly severity: RuntimeEventSeverity;
  readonly workerName?: string | null;
  readonly failurePhase?: string | null;
  readonly retryReason?: string | null;
  readonly runtimeState?: string | null;
  readonly detailJson?: unknown;
};

export async function createRuntimeEvent(input: CreateRuntimeEventInput): Promise<void> {
  await prisma.runtimeEvent.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      executionJobId: input.executionJobId ?? null,
      eventType: input.eventType,
      severity: input.severity,
      workerName: input.workerName ?? null,
      failurePhase: input.failurePhase ?? null,
      retryReason: input.retryReason ?? null,
      runtimeState: input.runtimeState ?? null,
      detailJson: (input.detailJson ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function listRuntimeEventsForExecRun(input: {
  readonly execRunId: string;
  readonly limit?: number;
}): Promise<RuntimeTimelineRow[]> {
  const limit = input.limit ?? 40;
  const rows = await prisma.runtimeEvent.findMany({
    where: { execRunId: input.execRunId },
    orderBy: { createdAt: "asc" },
    take: limit * 2,
    select: {
      createdAt: true,
      eventType: true,
      severity: true,
      workerName: true,
      detailJson: true,
    },
  });

  return rows.map((r) => ({
    createdAt: r.createdAt.toISOString(),
    source: "runtime_event" as const,
    eventType: r.eventType,
    status: r.severity,
    workerName: r.workerName,
    message: r.eventType,
    detail: r.detailJson,
  }));
}
