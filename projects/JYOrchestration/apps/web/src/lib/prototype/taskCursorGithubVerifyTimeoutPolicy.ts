import {
  resolveEffectiveGithubLaunchMs,
  TASK_CURSOR_GITHUB_INITIAL_WAIT_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import type { TaskCursorGithubVerifyDetailReason } from "@/lib/prototype/taskCursorGithubVerify";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/** GitHub verify soft timeout — branch missing 등으로 전환 */
export const TASK_CURSOR_GITHUB_VERIFY_SOFT_TIMEOUT_MS = 10 * 60 * 1000;

/** GitHub verify hard timeout — retryable failure (P3-M38: 10분) */
export const TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS = 10 * 60 * 1000;

export type GithubVerifyStuckEscalation =
  | "none"
  | "github_branch_missing"
  | "github_verify_timeout";

export function resolveGithubVerifyElapsedMs(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
  readonly dbRun?: ImplementationRuntimeRunView | null;
  readonly nowMs?: number;
}): number {
  const now = input.nowMs ?? Date.now();
  const launchMs = resolveEffectiveGithubLaunchMs({
    quickRun: input.quickRun,
    run: input.run,
    dbRun: input.dbRun,
    execution: input.execution,
  });
  return Math.max(0, now - launchMs);
}

export function resolveGithubVerifyStuckEscalation(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly verifyDetailReason?: TaskCursorGithubVerifyDetailReason | null;
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
  readonly dbRun?: ImplementationRuntimeRunView | null;
  readonly nowMs?: number;
}): GithubVerifyStuckEscalation {
  if (
    input.execution.status !== "github_verifying" &&
    input.execution.status !== "cursor_completed" &&
    input.execution.status !== "cursor_running"
  ) {
    return "none";
  }

  const elapsed = resolveGithubVerifyElapsedMs(input);

  if (elapsed >= TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS) {
    if (input.verifyDetailReason === "branch_not_found") {
      return "github_branch_missing";
    }
    return "github_verify_timeout";
  }

  if (
    elapsed >= TASK_CURSOR_GITHUB_VERIFY_SOFT_TIMEOUT_MS &&
    (input.execution.status === "github_verifying" ||
      input.execution.status === "cursor_completed")
  ) {
    if (input.verifyDetailReason === "branch_not_found") {
      return "github_branch_missing";
    }
    return "github_verify_timeout";
  }

  if (
    input.verifyDetailReason === "branch_not_found" &&
    elapsed >= TASK_CURSOR_GITHUB_INITIAL_WAIT_MS * 5
  ) {
    const branch = String(input.execution.workBranch ?? "").trim();
    if (branch) return "github_branch_missing";
  }

  return "none";
}

export function isRetryableGithubVerifyFailureReason(
  reason: string | null | undefined,
): boolean {
  const r = String(reason ?? "").trim();
  return r === "github_verify_timeout" || r === "github_branch_missing" || r === "github_verify_state_sync_failed";
}
