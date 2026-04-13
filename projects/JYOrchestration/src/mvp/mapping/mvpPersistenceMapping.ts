/**
 * MVP — persistence mapping spec: how in-memory engine shapes map to suggested stored rows.
 * No Prisma client; plain types + pure helpers for future schema/API migration.
 */

import type { ExecutionRun, ExecutionTaskState, MvpFailureCode } from "../contracts/mvpExecutionTypes";
import type { MvpStructuredFailure } from "../contracts/mvpStructuredFailure";
import type { RunMeta } from "../ports/mvpPorts";
import type {
  MvpExecutionStepRecord,
  MvpExecutionStepStatus,
  MvpExecutionStepType,
} from "../execution/executionStepLog";

/** Suggested single-row run aggregate (tasks often live in a child table or JSON column). */
export type MvpPersistedRunRow = {
  id: string;
  projectId: string;
  status: ExecutionRun["status"];
  currentTaskIndex: number;
};

/**
 * Suggested per-task snapshot row (FK `runId`; `sortOrder` is index in `ExecutionRun.tasks[]`).
 * Nullable columns mirror optional fields commonly stored in SQL.
 */
export type MvpPersistedTaskStateRow = {
  runId: string;
  sortOrder: number;
  taskId: string;
  status: ExecutionTaskState["status"];
  retryCount: number;
  lastFailureWasNonRetryable: boolean | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  lastFailureRetryable: boolean | null;
  totalExecuteAttempts: number | null;
};

/** Suggested append-only step/event row (`failurePayloadJson` for a JSON/JsonB column). */
export type MvpPersistedStepRow = {
  runId: string;
  taskId: string;
  sequence: number;
  stepType: string;
  status: string;
  message: string;
  /** Unix ms (maps to `DateTime` / `BigInt` in Prisma). */
  timestampMs: number;
  failurePayloadJson: string | null;
};

/** Suggested auxiliary run meta row (terminal failure string, etc.). */
export type MvpPersistedRunMetaRow = {
  runId: string;
  failureReason: string | null;
};

export function splitExecutionRunForPersistence(run: ExecutionRun): {
  run: MvpPersistedRunRow;
  tasks: MvpPersistedTaskStateRow[];
} {
  return {
    run: {
      id: run.id,
      projectId: run.projectId,
      status: run.status,
      currentTaskIndex: run.currentTaskIndex,
    },
    tasks: run.tasks.map((t, sortOrder) => ({
      runId: run.id,
      sortOrder,
      taskId: t.taskId,
      status: t.status,
      retryCount: t.retryCount,
      lastFailureWasNonRetryable: t.lastFailureWasNonRetryable ?? null,
      lastFailureCode: t.lastFailureCode ?? null,
      lastFailureMessage: t.lastFailureMessage ?? null,
      lastFailureRetryable: t.lastFailureRetryable ?? null,
      totalExecuteAttempts: t.totalExecuteAttempts ?? null,
    })),
  };
}

export function mergePersistedRunParts(runRow: MvpPersistedRunRow, taskRows: MvpPersistedTaskStateRow[]): ExecutionRun {
  const sorted = [...taskRows].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: runRow.id,
    projectId: runRow.projectId,
    status: runRow.status,
    currentTaskIndex: runRow.currentTaskIndex,
    tasks: sorted.map((row) => ({
      taskId: row.taskId,
      status: row.status,
      retryCount: row.retryCount,
      ...(row.lastFailureWasNonRetryable != null ? { lastFailureWasNonRetryable: row.lastFailureWasNonRetryable } : {}),
      ...(row.lastFailureCode != null ? { lastFailureCode: row.lastFailureCode as MvpFailureCode } : {}),
      ...(row.lastFailureMessage != null ? { lastFailureMessage: row.lastFailureMessage } : {}),
      ...(row.lastFailureRetryable != null ? { lastFailureRetryable: row.lastFailureRetryable } : {}),
      ...(row.totalExecuteAttempts != null ? { totalExecuteAttempts: row.totalExecuteAttempts } : {}),
    })),
  };
}

export function mvpStepRecordToPersistedRow(s: MvpExecutionStepRecord): MvpPersistedStepRow {
  return {
    runId: s.runId,
    taskId: s.taskId,
    sequence: s.sequence,
    stepType: s.stepType,
    status: s.status,
    message: s.message,
    timestampMs: s.timestamp,
    failurePayloadJson: s.failurePayload != null ? JSON.stringify(s.failurePayload) : null,
  };
}

export function mvpPersistedRowToStepRecord(r: MvpPersistedStepRow): MvpExecutionStepRecord {
  let failurePayload: MvpStructuredFailure | undefined;
  if (r.failurePayloadJson != null && r.failurePayloadJson.length > 0) {
    failurePayload = JSON.parse(r.failurePayloadJson) as MvpStructuredFailure;
  }
  return {
    runId: r.runId,
    taskId: r.taskId,
    sequence: r.sequence,
    stepType: r.stepType as MvpExecutionStepType,
    status: r.status as MvpExecutionStepStatus,
    message: r.message,
    timestamp: r.timestampMs,
    ...(failurePayload != null ? { failurePayload } : {}),
  };
}

export function runMetaToPersistedRow(runId: string, meta: RunMeta | undefined): MvpPersistedRunMetaRow {
  return {
    runId,
    failureReason: meta?.failureReason ?? null,
  };
}

export function persistedMetaRowToRunMeta(row: MvpPersistedRunMetaRow): RunMeta {
  if (row.failureReason == null || row.failureReason === "") {
    return {};
  }
  return { failureReason: row.failureReason };
}
