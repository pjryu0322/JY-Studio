import {
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";

export type TaskCursorFailureScope =
  | "global_blocker"
  | "task_rework"
  | "dependency_blocker"
  | "transient_retry";

export type TaskCursorFailurePolicy = Readonly<{
  readonly scope: TaskCursorFailureScope;
  readonly canContinueIndependentTasks: boolean;
  readonly shouldRetrySameTask: boolean;
  readonly shouldStopAll: boolean;
  readonly userMessage: string;
}>;

const GLOBAL_BLOCKER_REASONS = new Set<TaskCursorFailureReason>([
  "cursor_auth_failed",
  "github_auth_failed",
  "cursor_endpoint_unsupported",
]);

const TASK_REWORK_REASONS = new Set<TaskCursorFailureReason>([
  "commit_not_created",
  "push_failed",
  "no_changed_files",
  "github_verify_failed",
  "poll_cancelled",
  "unknown",
]);

function isPushFailureGlobalBlocker(message: string | undefined): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("auth") ||
    normalized.includes("token") ||
    normalized.includes("permission") ||
    normalized.includes("403") ||
    normalized.includes("401") ||
    normalized.includes("환경") ||
    normalized.includes("설정")
  );
}

export function resolveTaskCursorFailurePolicy(input: {
  readonly failureReason?: TaskCursorFailureReason | null;
  readonly message?: string | null;
}): TaskCursorFailurePolicy {
  const reason = input.failureReason ?? "unknown";
  const message =
    input.message?.trim() ||
    TASK_CURSOR_FAILURE_MESSAGES[reason] ||
    TASK_CURSOR_FAILURE_MESSAGES.unknown;

  if (GLOBAL_BLOCKER_REASONS.has(reason)) {
    return {
      scope: "global_blocker",
      canContinueIndependentTasks: false,
      shouldRetrySameTask: false,
      shouldStopAll: true,
      userMessage: message,
    };
  }

  if (reason === "push_failed" && isPushFailureGlobalBlocker(input.message ?? undefined)) {
    return {
      scope: "global_blocker",
      canContinueIndependentTasks: false,
      shouldRetrySameTask: false,
      shouldStopAll: true,
      userMessage: message,
    };
  }

  if (TASK_REWORK_REASONS.has(reason)) {
    return {
      scope: "task_rework",
      canContinueIndependentTasks: true,
      shouldRetrySameTask: false,
      shouldStopAll: false,
      userMessage: message,
    };
  }

  return {
    scope: "task_rework",
    canContinueIndependentTasks: true,
    shouldRetrySameTask: false,
    shouldStopAll: false,
    userMessage: message,
  };
}

export function resolveTaskCursorFailurePolicyFromExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): TaskCursorFailurePolicy | null {
  if (!execution) return null;
  if (execution.status !== "cursor_failed" && execution.status !== "github_verify_failed") {
    return null;
  }
  return resolveTaskCursorFailurePolicy({
    failureReason: execution.failureReason,
    message: execution.errorMessage,
  });
}

export function canContinueTaskCursorAutoChainAfterFailure(
  execution: TaskCursorExecutionV1 | null | undefined,
): boolean {
  const policy = resolveTaskCursorFailurePolicyFromExecution(execution);
  if (!policy) return false;
  return policy.canContinueIndependentTasks && !policy.shouldStopAll;
}
