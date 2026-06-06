import type { CodeTaskGithubOutcomeV1 } from "@/lib/prototype/codeTaskGithubOutcome";
import { patchTaskCursorExecution, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

/** run.githubOutcome이 확정되면 taskCursor의 stale github_verifying in-flight를 제거한다. */
export function clearStaleTaskCursorInflightForVerifiedRun(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly githubOutcome: CodeTaskGithubOutcomeV1;
  readonly nowIso?: string;
}): Readonly<{
  readonly cleared: boolean;
  readonly priorStatus?: string;
  readonly execution?: TaskCursorExecutionV1;
}> {
  const outcome = input.githubOutcome;
  if (outcome.status !== "verified" && outcome.status !== "failed") {
    return { cleared: false };
  }
  const status = input.execution.status;
  if (status !== "github_verifying" && status !== "cursor_completed") {
    return { cleared: false };
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  if (outcome.status === "failed") {
    return {
      cleared: true,
      priorStatus: status,
      execution: patchTaskCursorExecution(input.execution, {
        status: "github_verify_failed",
        failureReason:
          outcome.reason === "github_verify_state_sync_failed"
            ? "github_verify_state_sync_failed"
            : outcome.reason === "github_verify_timeout"
              ? "github_verify_timeout"
              : outcome.reason === "github_branch_missing"
                ? "github_branch_missing"
                : "github_verify_failed",
        errorMessage: outcome.message ?? undefined,
        githubProgressLastCheckAt: undefined,
        nowIso,
      }),
    };
  }
  return {
    cleared: true,
    priorStatus: status,
    execution: patchTaskCursorExecution(input.execution, {
      status: "review_pending",
      commitSha: outcome.commitSha,
      workBranch: outcome.workBranch,
      failureReason: undefined,
      errorMessage: undefined,
      githubProgressLastCheckAt: undefined,
      nowIso,
    }),
  };
}

export function isTaskCursorInFlightForRunOutcome(input: {
  readonly execution: TaskCursorExecutionV1 | null | undefined;
  readonly runHasTerminalGithub: boolean;
}): boolean {
  const execution = input.execution;
  if (!execution) return false;
  if (input.runHasTerminalGithub) return false;
  return execution.status === "cursor_requested" || execution.status === "cursor_running";
}
