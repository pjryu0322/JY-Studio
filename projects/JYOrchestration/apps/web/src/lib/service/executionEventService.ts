import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyFailure } from "@/lib/execution/failureClassifier";
import { FAILURE_TYPES, type FailureType } from "@/lib/execution/failureTypes";

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

  // FAILED 이벤트의 detailJson 구조를 통일해, 이후 실패 분류/분석에 필요한 키를 항상 제공한다.
  let normalizedDetailJson: Prisma.InputJsonValue | undefined = input.detailJson;
  if (input.status === "FAILED") {
    const d = (input.detailJson ?? {}) as unknown;
    const obj =
      d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};

    normalizedDetailJson = {
      ...obj,
      step: obj.step ?? input.stage,
      error: obj.error ?? input.message ?? undefined,
      rawError: obj.rawError ?? input.message ?? undefined,
      attempt: obj.attempt ?? 1,
    } as Prisma.InputJsonValue;
  }

  let failureType: FailureType | undefined;
  if (input.status === "FAILED") {
    failureType = classifyFailure({
      stage: input.stage,
      message: input.message ?? null,
      detailJson: normalizedDetailJson,
    });
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
      failureType: failureType ?? null,
      detailJson: normalizedDetailJson,
      durationMs,
    },
  });
}
