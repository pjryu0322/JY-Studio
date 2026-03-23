import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ExecutionEventStage =
  | "PRECHECK"
  | "EXECUTE"
  | "APPLY"
  | "PR"
  | "RETRY"
  | "COMPLETE";

export type ExecutionEventStatus = "STARTED" | "SUCCESS" | "FAILED";

export async function logExecutionEvent(input: {
  projectId: string;
  executionJobId: string;
  taskId?: string | null;
  gitChangeRequestId?: string | null;
  stage: ExecutionEventStage;
  status: ExecutionEventStatus;
  message?: string;
  detailJson?: Prisma.InputJsonValue;
  startedAt?: Date | string;
}): Promise<void> {
  const now = new Date();
  let durationMs: number | null = null;
  if (input.startedAt) {
    durationMs = Math.max(0, now.getTime() - new Date(input.startedAt).getTime());
  }

  await prisma.executionEventLog.create({
    data: {
      projectId: input.projectId,
      executionJobId: input.executionJobId,
      taskId: input.taskId ?? null,
      gitChangeRequestId: input.gitChangeRequestId ?? null,
      stage: input.stage,
      status: input.status,
      message: input.message ?? null,
      detailJson: input.detailJson,
      durationMs,
    },
  });
}
