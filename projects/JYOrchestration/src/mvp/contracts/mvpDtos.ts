/**
 * MVP — plain DTO / read-model types for future external exposure (no HTTP layer here).
 */

import type { ExecutionTaskState } from "./mvpExecutionTypes";
import type { MvpStructuredFailure } from "./mvpStructuredFailure";
import type { MvpExecutionStepRecord } from "../execution/executionStepLog";
import type { MvpRunDetailProjection, MvpRunSummaryProjection } from "../execution/mvpRunSummary";

export type MvpReadinessDto = {
  projectId: string;
  isReady: boolean;
  blockers: readonly string[];
};

export type MvpTaskStateDto = {
  taskId: string;
  status: ExecutionTaskState["status"];
  retryCount: number;
  lastFailureWasNonRetryable?: boolean;
  lastFailureCode?: string;
  lastFailureMessage?: string;
  lastFailureRetryable?: boolean;
  totalExecuteAttempts?: number;
};

export type MvpExecutionStepDto = {
  runId: string;
  taskId: string;
  sequence: number;
  stepType: string;
  status: string;
  message: string;
  timestamp: number;
  failurePayload?: MvpStructuredFailure;
};

export type MvpRunSummaryDto = {
  runId: string;
  runStatus: "RUNNING" | "SUCCESS" | "FAILED";
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskId: string | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  totalStepCount: number;
  /** Structured failure from the last failure step when present. */
  lastFailurePayload?: MvpStructuredFailure;
};

export type MvpRunDetailRetrySummaryDto = {
  /** Count of `TASK_RETRY_SCHEDULED` steps in the log. */
  automaticRetrySteps: number;
  /** Sum of per-task `retryCount` fields on the run. */
  totalTaskRetryCount: number;
  /** Maximum `retryCount` among tasks. */
  maxTaskRetryCount: number;
};

/** Detailed run inspection DTO (tasks + retries + failure + optional step flow). */
export type MvpRunDetailDto = {
  runId: string;
  runStatus: "RUNNING" | "SUCCESS" | "FAILED";
  currentTaskId: string | null;
  tasks: MvpTaskStateDto[];
  totalStepCount: number;
  latestFailurePayload?: MvpStructuredFailure;
  retrySummary: MvpRunDetailRetrySummaryDto;
  /** Compact `seq:TYPE → …` summary when steps exist. */
  stepFlowSummary?: string;
};

export function toMvpReadinessDto(input: {
  projectId: string;
  isReady: boolean;
  blockers: string[];
}): MvpReadinessDto {
  return {
    projectId: input.projectId,
    isReady: input.isReady,
    blockers: [...input.blockers],
  };
}

export function toMvpTaskStateDto(t: ExecutionTaskState): MvpTaskStateDto {
  return {
    taskId: t.taskId,
    status: t.status,
    retryCount: t.retryCount,
    lastFailureWasNonRetryable: t.lastFailureWasNonRetryable,
    lastFailureCode: t.lastFailureCode,
    lastFailureMessage: t.lastFailureMessage,
    lastFailureRetryable: t.lastFailureRetryable,
    totalExecuteAttempts: t.totalExecuteAttempts,
  };
}

export function toMvpExecutionStepDto(s: MvpExecutionStepRecord): MvpExecutionStepDto {
  return {
    runId: s.runId,
    taskId: s.taskId,
    sequence: s.sequence,
    stepType: s.stepType,
    status: s.status,
    message: s.message,
    timestamp: s.timestamp,
    failurePayload: s.failurePayload,
  };
}

export function toMvpRunSummaryDto(p: MvpRunSummaryProjection): MvpRunSummaryDto {
  return {
    runId: p.runId,
    runStatus: p.runStatus,
    totalTasks: p.totalTasks,
    completedTasks: p.completedTasks,
    failedTasks: p.failedTasks,
    currentTaskId: p.currentTaskId,
    lastFailureCode: p.lastFailureCode,
    lastFailureMessage: p.lastFailureMessage,
    totalStepCount: p.totalStepCount,
    lastFailurePayload: p.lastFailurePayload,
  };
}

export function toMvpRunDetailDto(p: MvpRunDetailProjection): MvpRunDetailDto {
  return {
    runId: p.runId,
    runStatus: p.runStatus,
    currentTaskId: p.currentTaskId,
    tasks: p.tasks.map(toMvpTaskStateDto),
    totalStepCount: p.totalStepCount,
    latestFailurePayload: p.latestFailurePayload,
    retrySummary: {
      automaticRetrySteps: p.retrySummary.automaticRetrySteps,
      totalTaskRetryCount: p.retrySummary.totalTaskRetryCount,
      maxTaskRetryCount: p.retrySummary.maxTaskRetryCount,
    },
    stepFlowSummary: p.stepFlowSummary,
  };
}
