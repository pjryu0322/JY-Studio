import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { normalizeCodeTaskQualityOutcomeFromRun } from "@/lib/prototype/codeTaskQualityOutcome";
import { isCursorSessionStaleForRun, type CursorSession } from "@/lib/prototype/cursorSessionModel";
import type {
  CodeTaskRun,
  ImplementationExecutionEvent,
} from "@/lib/prototype/implementationRuntimeStateModel";
import type { ImplementationRuntimeQueue } from "@/lib/prototype/implementationRuntimeQueueModel";

export type ImplementationRuntimeStateIssue = Readonly<{
  readonly code:
    | "cursor_session_stale_after_run_completed"
    | "cursor_session_stale_after_run_terminal"
    | "queue_current_run_completed"
    | "run_verified_but_missing_commitSha"
    | "run_completed_without_qualityOutcome"
    | "event_completed_but_run_not_completed"
    | "integration_included_without_run_completion";
  readonly runId?: string | null;
  readonly codeTaskId?: string | null;
  readonly message: string;
}>;

export function logImplementationRuntimeStateDiagnostics(
  issues: readonly ImplementationRuntimeStateIssue[],
): void {
  if (!issues.length) return;
  console.warn(
    "[implementation_runtime_state_diagnostics_detected]",
    JSON.stringify({ count: issues.length, issues }),
  );
}

export function diagnoseImplementationRuntimeState(input: {
  readonly runs: readonly CodeTaskRun[];
  readonly queue: ImplementationRuntimeQueue;
  readonly cursorSessions: readonly CursorSession[];
  readonly events?: readonly ImplementationExecutionEvent[];
}): readonly ImplementationRuntimeStateIssue[] {
  const issues: ImplementationRuntimeStateIssue[] = [];
  const runById = new Map(input.runs.map((r) => [r.runId, r] as const));

  for (const session of input.cursorSessions) {
    const run =
      (session.runId ? runById.get(session.runId) : null) ??
      input.runs.find((r) => r.processTaskId === session.processTaskId) ??
      null;
    if (
      run &&
      (run.status === "completed" || run.status === "no_code_change_completed") &&
      (session.status === "running" || session.status === "requested")
    ) {
      issues.push({
        code: "cursor_session_stale_after_run_completed",
        runId: run.runId,
        codeTaskId: run.codeTaskId,
        message: "Completed run still has an active Cursor session view.",
      });
    }
    if (run && isCursorSessionStaleForRun({ session, run })) {
      issues.push({
        code: "cursor_session_stale_after_run_terminal",
        runId: run.runId,
        codeTaskId: run.codeTaskId,
        message: "cursor_session_stale_state_ignored: run terminal while session in-flight.",
      });
    }
  }

  if (input.queue.currentRunId) {
    const current = runById.get(input.queue.currentRunId);
    if (current && (current.status === "completed" || current.status === "no_code_change_completed")) {
      issues.push({
        code: "queue_current_run_completed",
        runId: current.runId,
        codeTaskId: current.codeTaskId,
        message: "Queue currentRunId points at a completed run.",
      });
    }
  }

  for (const run of input.runs) {
    const github = normalizeCodeTaskGithubOutcomeFromRun(run);
    if (github?.status === "verified" && !String(github.commitSha ?? "").trim()) {
      issues.push({
        code: "run_verified_but_missing_commitSha",
        runId: run.runId,
        codeTaskId: run.codeTaskId,
        message: "githubOutcome verified without commitSha.",
      });
    }
    if (
      (run.status === "completed" || run.status === "no_code_change_completed") &&
      !normalizeCodeTaskQualityOutcomeFromRun(run)
    ) {
      issues.push({
        code: "run_completed_without_qualityOutcome",
        runId: run.runId,
        codeTaskId: run.codeTaskId,
        message: "Completed run has no qualityOutcome (legacy data may rely on EventLog).",
      });
    }
  }

  for (const event of input.events ?? []) {
    if (event.type === "implementation_auto_quality_gate_passed" && event.codeTaskId) {
      const run =
        (event.runId ? runById.get(event.runId) : null) ??
        input.runs.find((r) => r.codeTaskId === event.codeTaskId);
      if (run && run.status !== "completed" && run.status !== "no_code_change_completed") {
        const q = normalizeCodeTaskQualityOutcomeFromRun(run);
        if (q?.status !== "passed") {
          issues.push({
            code: "event_completed_but_run_not_completed",
            runId: run.runId,
            codeTaskId: run.codeTaskId,
            message: "EventLog shows gate passed but run is not completed/passed.",
          });
        }
      }
    }
  }

  return issues;
}
