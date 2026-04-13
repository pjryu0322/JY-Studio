/**
 * MVP — isolated in-memory run fixtures for policy/self-check tests only.
 */

import type { ExecutionRun } from "../execution/executionService";
import {
  DEFAULT_MAX_RETRY_COUNT,
  mvpTestingRegisterRunSnapshot,
} from "../execution/executionService";

let fixtureSeq = 0;

function nextFixtureRunId(): string {
  fixtureSeq += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mvp-fixture-${Date.now()}-${fixtureSeq}`;
}

/** Installs a RUNNING run with one FAILED task already at `DEFAULT_MAX_RETRY_COUNT`. */
export function mvpTestInstallRunAtRetryLimit(input: { projectId: string; taskId: string }): string {
  const runId = nextFixtureRunId();
  const run: ExecutionRun = {
    id: runId,
    projectId: input.projectId,
    status: "RUNNING",
    currentTaskIndex: 0,
    tasks: [
      {
        taskId: input.taskId,
        status: "FAILED",
        retryCount: DEFAULT_MAX_RETRY_COUNT,
        lastFailureWasNonRetryable: false,
        totalExecuteAttempts: 0,
      },
    ],
  };
  mvpTestingRegisterRunSnapshot(run);
  return runId;
}

/** Installs a RUNNING run whose single task FAILED with a non-retryable last failure. */
export function mvpTestInstallRunWithNonRetryableFailure(input: {
  projectId: string;
  taskId: string;
}): string {
  const runId = nextFixtureRunId();
  const run: ExecutionRun = {
    id: runId,
    projectId: input.projectId,
    status: "RUNNING",
    currentTaskIndex: 0,
    tasks: [
      {
        taskId: input.taskId,
        status: "FAILED",
        retryCount: 0,
        lastFailureWasNonRetryable: true,
        lastFailureCode: "REVIEW_FAILED",
        lastFailureMessage: "mvp forced non-retryable review failure",
        lastFailureRetryable: false,
        totalExecuteAttempts: 0,
      },
    ],
  };
  mvpTestingRegisterRunSnapshot(run);
  return runId;
}
