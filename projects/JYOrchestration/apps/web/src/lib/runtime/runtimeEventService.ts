/**
 * Unified runtime event helper — Task progress log + optional execution job event log.
 */

import type { Prisma } from "@prisma/client";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logExecutionEvent } from "@/lib/service/executionEventService";
import type { RuntimeEventSeverity, RuntimeEventType } from "@/lib/runtime/runtimeEventTypes";

export type AppendRuntimeEventInput = {
  readonly eventType: RuntimeEventType;
  readonly severity?: RuntimeEventSeverity;
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId?: string | null;
  readonly workerName?: string | null;
  readonly failurePhase?: string | null;
  readonly retryReason?: string | null;
  readonly runtimeState?: string | null;
  readonly executionJobId?: string | null;
  readonly detail?: Record<string, unknown>;
};

function severityToProgressKind(severity: RuntimeEventSeverity): "execution" | "warning" | "error" {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "execution";
}

export async function appendRuntimeEvent(input: AppendRuntimeEventInput): Promise<void> {
  const severity = input.severity ?? "info";
  const detail = {
    eventType: input.eventType,
    execRunId: input.execRunId,
    workerName: input.workerName ?? null,
    failurePhase: input.failurePhase ?? null,
    retryReason: input.retryReason ?? null,
    runtimeState: input.runtimeState ?? null,
    ...(input.detail ?? {}),
  };

  appendTaskProgressLog({
    kind: severityToProgressKind(severity),
    phase: input.eventType.toLowerCase(),
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId ?? undefined,
    detail,
  });

  if (input.executionJobId) {
    const status = severity === "error" ? "FAILED" : "SUCCESS";
    await logExecutionEvent({
      projectId: input.projectId,
      executionJobId: input.executionJobId,
      taskId: input.taskId,
      stage: "EXECUTE",
      status: status === "FAILED" ? "FAILED" : "SUCCESS",
      message: input.eventType,
      detailJson: detail as Prisma.InputJsonValue,
    }).catch(() => {});
  }
}
