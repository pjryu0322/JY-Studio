/**
 * MVP — run-level read model combining execution state and step log (in-memory only).
 */

import type { MvpStructuredFailure } from "../contracts/mvpStructuredFailure";
import { getRunStatus } from "./executionService";
import { mvpGetExecutionStepsForRun } from "./executionStepLog";
import { mvpGetLastFailureStepForRun } from "./executionStepProjections";

const KNOWN_FAILURE_PREFIXES = [
  "CURSOR_FAILED",
  "GIT_BRANCH_MISSING",
  "REVIEW_FAILED",
  "TASK_NOT_FOUND",
  "UNHANDLED",
] as const;

function inferFailureCodeFromStep(step: {
  stepType: string;
  message: string;
  failurePayload?: MvpStructuredFailure;
}): string | null {
  if (step.failurePayload) {
    return step.failurePayload.failureCode;
  }
  if (step.stepType === "CURSOR_FAILED") {
    return "CURSOR_FAILED";
  }
  if (step.stepType === "GIT_FAILED") {
    return "GIT_BRANCH_MISSING";
  }
  if (step.stepType === "REVIEW_FAILED") {
    return "REVIEW_FAILED";
  }
  if (step.stepType === "RUN_FAILED") {
    const msg = step.message;
    for (const p of KNOWN_FAILURE_PREFIXES) {
      if (msg.startsWith(p) || msg.startsWith(`${p}:`)) {
        return p;
      }
    }
    return "RUN_FAILED";
  }
  return null;
}

export type MvpRunSummaryProjection = {
  runId: string;
  runStatus: "RUNNING" | "SUCCESS" | "FAILED";
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  /** Active task id while RUNNING, else null. */
  currentTaskId: string | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  /** Structured payload from the last failure step when recorded. */
  lastFailurePayload?: MvpStructuredFailure;
  totalStepCount: number;
};

/**
 * Builds a summary for a run. Returns null when the run is not present in memory.
 */
export async function mvpProjectRunSummary(runId: string): Promise<MvpRunSummaryProjection | null> {
  const run = await getRunStatus(runId);
  if (run.failureReason === "RUN_NOT_FOUND") {
    return null;
  }

  const steps = mvpGetExecutionStepsForRun(runId);
  const completedTasks = run.tasks.filter((t) => t.status === "SUCCESS").length;
  const failedTasks = run.tasks.filter((t) => t.status === "FAILED").length;

  let currentTaskId: string | null = null;
  if (run.status === "RUNNING" && run.currentTaskIndex >= 0 && run.currentTaskIndex < run.tasks.length) {
    currentTaskId = run.tasks[run.currentTaskIndex]!.taskId;
  }

  const lastFail = mvpGetLastFailureStepForRun(runId);
  let lastFailureCode: string | null = null;
  let lastFailureMessage: string | null = null;
  let lastFailurePayload: MvpStructuredFailure | undefined;
  if (lastFail) {
    lastFailureMessage = lastFail.failurePayload?.failureMessage ?? lastFail.message;
    lastFailureCode = inferFailureCodeFromStep(lastFail);
    lastFailurePayload = lastFail.failurePayload;
  }

  if (run.status === "FAILED" && run.failureReason && !lastFailureMessage) {
    lastFailureMessage = run.failureReason;
    for (const p of KNOWN_FAILURE_PREFIXES) {
      if (run.failureReason.startsWith(p) || run.failureReason.startsWith(`${p}:`)) {
        lastFailureCode = p;
        break;
      }
    }
  }

  return {
    runId: run.id,
    runStatus: run.status,
    totalTasks: run.tasks.length,
    completedTasks,
    failedTasks,
    currentTaskId,
    lastFailureCode,
    lastFailureMessage,
    lastFailurePayload,
    totalStepCount: steps.length,
  };
}
