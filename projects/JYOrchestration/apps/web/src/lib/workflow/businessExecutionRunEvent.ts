/**
 * Lightweight event timeline for Business Execution Run.
 *
 * Append-only, in-memory for now. This is business execution domain state, NOT Stage1/Stage2 logs.
 */

import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { ExecutorConnectorResult } from "@/lib/workflow/executorConnector";
import type { BusinessExecutionRun, BusinessExecutionRunStatus } from "@/lib/workflow/businessExecutionRun";

export type BusinessExecutionRunEventType =
  | "run_created"
  | "connector_accepted"
  | "connector_running"
  | "connector_completed"
  | "connector_failed"
  | "retry_requested"
  | "retry_started"
  | "run_completed"
  | "run_failed";

export type BusinessExecutionRunEvent = {
  eventId: string;
  runId: string;
  sessionId: string;
  requirementId: string | null;
  executorType: ExecutionExecutorType;
  eventType: BusinessExecutionRunEventType;
  createdAtIso: string;
  message: string;
  source: "business_execution_run_event";
  statusSnapshot?: BusinessExecutionRunStatus;
  errorCode?: ExecutorConnectorResult["errorCode"];
  summary?: string;
};

function nextEventId(): string {
  return `bizexevt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createRunCreatedEvent(run: BusinessExecutionRun): BusinessExecutionRunEvent {
  const createdAtIso = new Date().toISOString();
  return {
    eventId: nextEventId(),
    runId: run.runId,
    sessionId: run.sessionId,
    requirementId: run.requirementId,
    executorType: run.executorType,
    eventType: "run_created",
    createdAtIso,
    message: `Run created · ${run.runId}`,
    source: "business_execution_run_event",
    statusSnapshot: run.status,
    summary: run.summary,
  };
}

export function createRetryRequestedEvent(run: BusinessExecutionRun): BusinessExecutionRunEvent {
  const createdAtIso = new Date().toISOString();
  return {
    eventId: nextEventId(),
    runId: run.runId,
    sessionId: run.sessionId,
    requirementId: run.requirementId,
    executorType: run.executorType,
    eventType: "retry_requested",
    createdAtIso,
    message: "Retry requested.",
    source: "business_execution_run_event",
    statusSnapshot: run.status,
  };
}

export function createRetryStartedEvent(run: BusinessExecutionRun): BusinessExecutionRunEvent {
  const createdAtIso = new Date().toISOString();
  return {
    eventId: nextEventId(),
    runId: run.runId,
    sessionId: run.sessionId,
    requirementId: run.requirementId,
    executorType: run.executorType,
    eventType: "retry_started",
    createdAtIso,
    message: "Retry started.",
    source: "business_execution_run_event",
    statusSnapshot: run.status,
  };
}

export function createRunEventFromConnectorResult(input: {
  run: BusinessExecutionRun;
  result: ExecutorConnectorResult;
}): BusinessExecutionRunEvent {
  const createdAtIso = new Date().toISOString();
  const type =
    input.result.status === "accepted"
      ? "connector_accepted"
      : input.result.status === "running"
        ? "connector_running"
        : input.result.status === "completed"
          ? "connector_completed"
          : "connector_failed";
  return {
    eventId: nextEventId(),
    runId: input.run.runId,
    sessionId: input.run.sessionId,
    requirementId: input.run.requirementId,
    executorType: input.run.executorType,
    eventType: type,
    createdAtIso,
    message: input.result.message,
    source: "business_execution_run_event",
    errorCode: input.result.errorCode,
    summary: input.result.resultSummary,
  };
}

export function createTerminalRunEventFromStatus(run: BusinessExecutionRun): BusinessExecutionRunEvent | null {
  if (run.status !== "completed" && run.status !== "failed") return null;
  const createdAtIso = new Date().toISOString();
  return {
    eventId: nextEventId(),
    runId: run.runId,
    sessionId: run.sessionId,
    requirementId: run.requirementId,
    executorType: run.executorType,
    eventType: run.status === "completed" ? "run_completed" : "run_failed",
    createdAtIso,
    message:
      run.status === "completed"
        ? "Run completed."
        : `Run failed.${run.errorMessage ? ` ${run.errorMessage}` : ""}`,
    source: "business_execution_run_event",
    statusSnapshot: run.status,
    summary: run.summary,
  };
}

