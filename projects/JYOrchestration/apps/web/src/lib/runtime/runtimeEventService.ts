/**
 * Unified runtime event helper — progress log + memory + RuntimeEvent table (+ optional compat log).
 */

import type { Prisma } from "@prisma/client";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logExecutionEvent } from "@/lib/service/executionEventService";
import type { RuntimeEventSeverity, RuntimeEventType } from "@/lib/runtime/runtimeEventTypes";
import { createRuntimeEvent } from "@/lib/runtime/runtimeEventRepository";
import {
  isRuntimeEventCompatExecutionLogEnabled,
  persistRuntimeEventToExecutionLog,
} from "@/lib/runtime/runtimeEventPersistence";
import { recordRuntimeTimelineEntry } from "@/lib/runtime/runtimeTimelineStore";

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
    runtimeTimeline: true,
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

  recordRuntimeTimelineEntry(input.execRunId, {
    source: "runtime_event",
    eventType: input.eventType,
    status: severity,
    workerName: input.workerName ?? null,
    message: input.eventType,
    detail,
  });

  await createRuntimeEvent({
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
    executionJobId: input.executionJobId ?? null,
    eventType: input.eventType,
    severity,
    workerName: input.workerName,
    failurePhase: input.failurePhase,
    retryReason: input.retryReason,
    runtimeState: input.runtimeState,
    detailJson: detail,
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[runtime-event] failed to persist RuntimeEvent", {
      eventType: input.eventType,
      execRunId: input.execRunId,
      taskId: input.taskId,
      error: msg.slice(0, 500),
    });
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
  } else if (isRuntimeEventCompatExecutionLogEnabled()) {
    await persistRuntimeEventToExecutionLog({
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      eventType: input.eventType,
      severity,
      detail,
      workerName: input.workerName,
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[runtime-event] compat executionEventLog mirror failed", {
        eventType: input.eventType,
        execRunId: input.execRunId,
        error: msg.slice(0, 500),
      });
    });
  }
}
