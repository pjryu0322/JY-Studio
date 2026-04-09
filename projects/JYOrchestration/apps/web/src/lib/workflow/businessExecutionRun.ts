/**
 * Business execution run: tracked invocation instance from a launch command (NOT Stage1/Stage2, NOT env test flow).
 */

import type { ActualExecutionAdapterRequest } from "@/lib/workflow/actualExecutionAdapter";
import type { ActualLaunchCommand } from "@/lib/workflow/actualLaunchCommand";
import { isActualLaunchCommandCurrent } from "@/lib/workflow/actualLaunchCommand";
import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import type { BusinessLaunchIntent } from "@/lib/workflow/businessLaunchIntent";
import type { ExecutionReadiness } from "@/lib/workflow/executionReadiness";
import type { ExecutionBridgePayload } from "@/lib/workflow/executionBridgePayload";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorLaunchContract } from "@/lib/workflow/executorLaunchContract";
import type { ExecutionTriggerIntent } from "@/lib/workflow/executionTriggerIntent";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";

export type BusinessExecutionRunStatus = "queued" | "running" | "completed" | "failed";

export type BusinessExecutionRun = {
  runId: string;
  launchCommandId: string;
  executorType: ExecutionExecutorType;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  startedAtIso: string;
  finishedAtIso?: string;
  status: BusinessExecutionRunStatus;
  source: "business_execution_run";
  summary?: string;
  errorMessage?: string;
  note?: string;
  /** Last monitoring line (local-only, not executor telemetry). */
  latestMessage?: string;
  /** Short progress label for compact UI. */
  progressLabel?: string;
  /** Last local update (transitions and control actions). */
  updatedAtIso?: string;
};

export function defaultBusinessExecutionRunProgress(status: BusinessExecutionRunStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Run";
  }
}

export function defaultBusinessExecutionRunMessage(status: BusinessExecutionRunStatus): string {
  switch (status) {
    case "queued":
      return "Waiting (local queue only · not dispatched).";
    case "running":
      return "In progress (local monitoring · not Stage1/Stage2).";
    case "completed":
      return "Completed (local mock · not env test flow).";
    case "failed":
      return "Failed (local mock · not env test flow).";
    default:
      return "Business execution run.";
  }
}

function nextRunId(): string {
  return `bizexrun-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Create a new run in `queued` from the current launch command (no Stage1/Stage2, no Git). */
export function invokeBusinessExecution(input: {
  command: ActualLaunchCommand;
  adapter: ActualExecutionAdapterRequest;
  triggerIntent: ExecutionTriggerIntent;
  contract: ExecutorLaunchContract;
  bridge: ExecutionBridgePayload;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string;
  note?: string;
}): BusinessExecutionRun {
  if (
    !isActualLaunchCommandCurrent({
      command: input.command,
      adapter: input.adapter,
      triggerIntent: input.triggerIntent,
      contract: input.contract,
      bridge: input.bridge,
      handoffRecord: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    throw new Error("invokeBusinessExecution: actual launch command is not current");
  }
  if (input.command.sessionId !== input.sessionId) {
    throw new Error("invokeBusinessExecution: command session mismatch");
  }
  const startedAtIso = new Date().toISOString();
  return {
    runId: nextRunId(),
    launchCommandId: input.command.launchCommandId,
    executorType: input.command.executorType,
    requirementId: input.command.requirementId,
    sessionId: input.command.sessionId,
    snapshotId: input.command.snapshotId,
    startedAtIso,
    updatedAtIso: startedAtIso,
    status: "queued",
    source: "business_execution_run",
    summary: input.command.summary ?? `Business execution run · ${input.command.launchCommandId}`,
    note: input.note,
    progressLabel: defaultBusinessExecutionRunProgress("queued"),
    latestMessage: "Run created · awaiting local control (not dispatched to any executor).",
  };
}

/** In-memory mock lifecycle only — does not dispatch real work. */
export function applyMockBusinessExecutionRunTransition(
  run: BusinessExecutionRun,
  transition: "to_running" | "complete" | "fail"
): BusinessExecutionRun {
  const now = new Date().toISOString();
  if (transition === "to_running") {
    if (run.status !== "queued") {
      throw new Error("applyMockBusinessExecutionRunTransition: run is not queued");
    }
    return {
      ...run,
      status: "running",
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("running"),
      latestMessage: "Marked running (local control · no real executor).",
    };
  }
  if (transition === "complete") {
    if (run.status !== "running" && run.status !== "queued") {
      throw new Error("applyMockBusinessExecutionRunTransition: run cannot be completed from this status");
    }
    const summary =
      run.status === "queued"
        ? "Mock completed (direct from queued)."
        : run.summary ?? "Mock completed successfully.";
    return {
      ...run,
      status: "completed",
      finishedAtIso: now,
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("completed"),
      latestMessage: "Marked completed (local mock · not env test).",
      summary,
      errorMessage: undefined,
    };
  }
  if (transition === "fail") {
    if (run.status !== "running" && run.status !== "queued") {
      throw new Error("applyMockBusinessExecutionRunTransition: run cannot fail from this status");
    }
    return {
      ...run,
      status: "failed",
      finishedAtIso: now,
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("failed"),
      latestMessage: "Marked failed (local mock · not env test).",
      errorMessage: run.errorMessage ?? "Mock failure (no real execution).",
      summary: run.summary,
    };
  }
  throw new Error("applyMockBusinessExecutionRunTransition: unknown transition");
}

/** Local control: queued → running (same as mock transition; naming for monitoring UI). */
export function markBusinessExecutionRunRunning(run: BusinessExecutionRun): BusinessExecutionRun {
  return applyMockBusinessExecutionRunTransition(run, "to_running");
}

/** Local control: queued or running → completed. */
export function markBusinessExecutionRunCompleted(run: BusinessExecutionRun): BusinessExecutionRun {
  return applyMockBusinessExecutionRunTransition(run, "complete");
}

/** Local control: queued or running → failed. */
export function markBusinessExecutionRunFailed(
  run: BusinessExecutionRun,
  errorMessage?: string
): BusinessExecutionRun {
  const next = applyMockBusinessExecutionRunTransition(run, "fail");
  if (!errorMessage) return next;
  const now = new Date().toISOString();
  return { ...next, errorMessage, updatedAtIso: now, latestMessage: errorMessage };
}

/**
 * Map a normalized executor connector result into the business execution run lifecycle.
 * This is business-side state shaping only; it does not call Stage1/Stage2 or any external executor.
 */
export function applyExecutorConnectorResultToBusinessExecutionRun(input: {
  run: BusinessExecutionRun;
  connectorResult: ExecutorConnectorResult;
}): BusinessExecutionRun {
  const now = new Date().toISOString();
  const result = input.connectorResult;
  if (result.executorType !== input.run.executorType) {
    throw new Error("applyExecutorConnectorResultToBusinessExecutionRun: executorType mismatch");
  }
  if (result.sessionId !== input.run.sessionId) {
    throw new Error("applyExecutorConnectorResultToBusinessExecutionRun: session mismatch");
  }
  if (result.requirementId !== input.run.requirementId) {
    // requirementId can be null, but should still align if present.
    throw new Error("applyExecutorConnectorResultToBusinessExecutionRun: requirement mismatch");
  }
  if (result.status === "accepted") {
    return {
      ...input.run,
      status: input.run.status === "completed" || input.run.status === "failed" ? "queued" : input.run.status,
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("queued"),
      latestMessage: `Connector accepted · ${result.message}`,
    };
  }
  if (result.status === "running") {
    return {
      ...input.run,
      status: "running",
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("running"),
      latestMessage: `Connector running · ${result.message}`,
    };
  }
  if (result.status === "completed") {
    return {
      ...input.run,
      status: "completed",
      finishedAtIso: result.finishedAtIso ?? now,
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("completed"),
      latestMessage: `Connector completed · ${result.message}`,
      summary: result.resultSummary ?? input.run.summary,
      errorMessage: undefined,
    };
  }
  if (result.status === "failed") {
    return {
      ...input.run,
      status: "failed",
      finishedAtIso: result.finishedAtIso ?? now,
      updatedAtIso: now,
      progressLabel: defaultBusinessExecutionRunProgress("failed"),
      latestMessage: `Connector failed · ${result.message}`,
      errorMessage: result.errorMessage ?? input.run.errorMessage ?? "Connector failed.",
      summary: input.run.summary,
    };
  }
  return input.run;
}

export function isBusinessExecutionRunCurrent(input: {
  run: BusinessExecutionRun | undefined;
  command: ActualLaunchCommand | undefined;
  adapter: ActualExecutionAdapterRequest | undefined;
  triggerIntent: ExecutionTriggerIntent | undefined;
  contract: ExecutorLaunchContract | undefined;
  bridge: ExecutionBridgePayload | undefined;
  handoffRecord: BusinessLaunchHandoffRecord | undefined;
  intent: BusinessLaunchIntent | undefined;
  readiness: ExecutionReadiness;
  workOrder: ExecutorWorkOrder | undefined;
  sessionId: string | null | undefined;
}): boolean {
  if (!input.run || !input.command || !input.sessionId) return false;
  if (
    !isActualLaunchCommandCurrent({
      command: input.command,
      adapter: input.adapter,
      triggerIntent: input.triggerIntent,
      contract: input.contract,
      bridge: input.bridge,
      handoffRecord: input.handoffRecord,
      intent: input.intent,
      readiness: input.readiness,
      workOrder: input.workOrder,
      sessionId: input.sessionId,
    })
  ) {
    return false;
  }
  return (
    input.run.source === "business_execution_run" &&
    input.run.launchCommandId === input.command.launchCommandId &&
    input.run.sessionId === input.sessionId &&
    input.run.snapshotId === input.command.snapshotId &&
    input.run.executorType === input.command.executorType &&
    input.run.requirementId === input.command.requirementId
  );
}

/** One-line hint for compact inline strips (e.g. requirement overview). */
export function businessExecutionRunStatusHint(run: BusinessExecutionRun): string {
  switch (run.status) {
    case "queued":
      return "Execution queued";
    case "running":
      return "Execution running";
    case "completed":
      return "Execution completed";
    case "failed":
      return "Execution failed";
    default:
      return "Business run";
  }
}

/** Compact strip when any latest run exists (current or stale vs command). */
export function businessExecutionRunLatestStrip(
  run: BusinessExecutionRun | undefined,
  isRunCurrent: boolean
): string | null {
  if (!run) return null;
  if (!isRunCurrent) {
    return "Business run on file · not tied to current launch command.";
  }
  return businessExecutionRunStatusHint(run);
}

/** Subtle copy for /tasks and /requirements strips. */
export function businessExecutionRunSubtleNote(run: BusinessExecutionRun): string {
  switch (run.status) {
    case "queued":
      return "Business execution queued · not Stage1/Stage2 · not launched.";
    case "running":
      return "Business execution running · not Stage1/Stage2.";
    case "completed":
      return "Business execution completed · not env test flow.";
    case "failed":
      return "Business execution failed · not env test flow.";
    default:
      return "Business execution run.";
  }
}
