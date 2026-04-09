/**
 * Page-ready monitoring view for business execution runs (NOT Stage1/Stage2, NOT real executor telemetry).
 */

import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";
import type { BusinessExecutionRun, BusinessExecutionRunStatus } from "@/lib/workflow/businessExecutionRun";
import {
  defaultBusinessExecutionRunMessage,
  defaultBusinessExecutionRunProgress,
} from "@/lib/workflow/businessExecutionRun";
import { getBusinessExecutionRunStateForSession } from "@/lib/workflow/businessExecutionRunGate";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import { resolveSessionConfirmedTasks } from "@/lib/workflow/collaborationSessionContentStore";

export type BusinessExecutionRunView = {
  runId: string;
  launchCommandId: string;
  executorType: ExecutionExecutorType;
  status: BusinessExecutionRunStatus;
  startedAtIso: string;
  finishedAtIso?: string;
  latestMessage: string;
  progressLabel: string;
  updatedAtIso: string;
  resultSummary?: string;
  errorMessage?: string;
  note?: string;
  isTerminal: boolean;
};

export type BusinessExecutionRunResolvedState = {
  storedRun: BusinessExecutionRun | undefined;
  isRunCurrent: boolean;
  isActualLaunchCommandCurrent: boolean;
  /** Current launch command + run currency. */
  view: BusinessExecutionRunView | null;
  /** Latest stored run when it no longer matches the current command (for compact disclosure). */
  staleRunView: BusinessExecutionRunView | null;
};

export type BusinessExecutionMonitoringState = BusinessExecutionRunResolvedState & {
  /** Stored run exists but does not match the current launch command (command may or may not be current). */
  hasStoredRunNotCurrent: boolean;
  /** True when launch command is current and a stored run does not match it (strong retry signal). */
  hasStaleRunVersusCommand: boolean;
  /** Local-only: mark queued → running */
  canMarkRunning: boolean;
  /** Local-only: mark running or queued → completed */
  canMarkCompleted: boolean;
  /** Local-only: mark running or queued → failed */
  canMarkFailed: boolean;
  /** New run from current command (after terminal, stale, or none). */
  canInvokeOrRetryRun: boolean;
  /** Active current run blocks a new invocation. */
  blockedByActiveCurrentRun: boolean;
};

export function getBusinessExecutionRunView(run: BusinessExecutionRun | undefined): BusinessExecutionRunView | null {
  if (!run) return null;
  const isTerminal = run.status === "completed" || run.status === "failed";
  const updatedAtIso = run.updatedAtIso ?? run.finishedAtIso ?? run.startedAtIso;
  return {
    runId: run.runId,
    launchCommandId: run.launchCommandId,
    executorType: run.executorType,
    status: run.status,
    startedAtIso: run.startedAtIso,
    finishedAtIso: run.finishedAtIso,
    latestMessage: run.latestMessage ?? defaultBusinessExecutionRunMessage(run.status),
    progressLabel: run.progressLabel ?? defaultBusinessExecutionRunProgress(run.status),
    updatedAtIso,
    resultSummary: run.status === "completed" ? run.summary : undefined,
    errorMessage: run.status === "failed" ? run.errorMessage : undefined,
    note: run.note,
    isTerminal,
  };
}

/** Low-level bundle: stored run + currency + derived view (no control flags). */
export function resolveBusinessExecutionRunState(input: {
  storedRun: BusinessExecutionRun | undefined;
  isRunCurrent: boolean;
  isActualLaunchCommandCurrent: boolean;
}): BusinessExecutionRunResolvedState {
  const view =
    input.storedRun && input.isRunCurrent ? getBusinessExecutionRunView(input.storedRun) : null;
  const staleRunView =
    input.storedRun && !input.isRunCurrent ? getBusinessExecutionRunView(input.storedRun) : null;
  return {
    storedRun: input.storedRun,
    isRunCurrent: input.isRunCurrent,
    isActualLaunchCommandCurrent: input.isActualLaunchCommandCurrent,
    view,
    staleRunView,
  };
}

export function getBusinessExecutionMonitoringStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): BusinessExecutionMonitoringState {
  const base = getBusinessExecutionRunStateForSession(sessionId, ctx);
  const storedRun = base.businessExecutionRun;
  const isRunCurrent = base.isBusinessExecutionRunCurrent;
  const hasStoredRunNotCurrent = Boolean(storedRun) && !isRunCurrent;
  const hasStaleRunVersusCommand = hasStoredRunNotCurrent && base.isActualLaunchCommandCurrent;
  const blockedByActiveCurrentRun =
    isRunCurrent &&
    (storedRun?.status === "queued" || storedRun?.status === "running");
  const canInvokeOrRetryRun = base.isActualLaunchCommandCurrent && !blockedByActiveCurrentRun;
  const canMarkRunning = Boolean(isRunCurrent && storedRun?.status === "queued");
  const canMarkCompleted = Boolean(
    isRunCurrent && storedRun && (storedRun.status === "queued" || storedRun.status === "running")
  );
  const canMarkFailed = canMarkCompleted;

  const resolved = resolveBusinessExecutionRunState({
    storedRun,
    isRunCurrent,
    isActualLaunchCommandCurrent: base.isActualLaunchCommandCurrent,
  });

  return {
    ...resolved,
    hasStoredRunNotCurrent,
    hasStaleRunVersusCommand,
    canMarkRunning,
    canMarkCompleted,
    canMarkFailed,
    canInvokeOrRetryRun,
    blockedByActiveCurrentRun,
  };
}

/** Convenience: same as getBusinessExecutionMonitoringStateForSession with confirmed tasks resolved. */
export function getBusinessExecutionMonitoringStateForSessionFromPre(
  sessionId: string | null | undefined,
  pre: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    candidateTasks: { id: string }[];
  }
): BusinessExecutionMonitoringState {
  const confirmed = resolveSessionConfirmedTasks(sessionId) ?? [];
  return getBusinessExecutionMonitoringStateForSession(sessionId, {
    snapshot: pre.snapshot,
    currentCandidateTaskIds: pre.candidateTasks.map((t) => t.id),
    currentConfirmedTaskIds: confirmed.map((t) => t.id),
  });
}
