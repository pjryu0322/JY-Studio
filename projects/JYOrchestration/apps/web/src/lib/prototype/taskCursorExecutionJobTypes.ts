import type { TaskCursorExecutionStatus, TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export const TASK_CURSOR_JOB_ACTIVE_STATUSES = [
  "queued",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
] as const;

export const TASK_CURSOR_JOB_TERMINAL_STATUSES = [
  "cursor_completed",
  "github_verified",
  "github_verify_failed",
  "review_pending",
  "security_pending",
  "scm_pending",
  "failed",
  "cancelled",
  "timeout",
  "completed",
] as const;

export type TaskCursorJobStatus =
  | (typeof TASK_CURSOR_JOB_ACTIVE_STATUSES)[number]
  | (typeof TASK_CURSOR_JOB_TERMINAL_STATUSES)[number]
  | TaskCursorExecutionStatus;

const TERMINAL_EXECUTION_STATUSES = new Set<string>([
  "cursor_completed",
  "cursor_failed",
  "github_verified",
  "github_verify_failed",
  "review_pending",
  "security_pending",
  "scm_pending",
  "blocked",
]);

const ACTIVE_EXECUTION_STATUSES = new Set<string>([
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

export function mapTaskCursorExecutionStatusToJobStatus(
  status: TaskCursorExecutionStatus | string,
): TaskCursorJobStatus {
  const normalized = String(status).trim();
  if (normalized === "cursor_failed") return "failed";
  return normalized as TaskCursorJobStatus;
}

export function isActiveTaskCursorJobStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim();
  return (
    TASK_CURSOR_JOB_ACTIVE_STATUSES.includes(normalized as (typeof TASK_CURSOR_JOB_ACTIVE_STATUSES)[number]) ||
    ACTIVE_EXECUTION_STATUSES.has(normalized)
  );
}

export function isTerminalTaskCursorJobStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim();
  if (!normalized) return false;
  if (TASK_CURSOR_JOB_TERMINAL_STATUSES.includes(normalized as (typeof TASK_CURSOR_JOB_TERMINAL_STATUSES)[number])) {
    return true;
  }
  return TERMINAL_EXECUTION_STATUSES.has(normalized);
}

export function isTerminalTaskCursorPollResultStatus(status: string | null | undefined): boolean {
  return isTerminalTaskCursorJobStatus(status) || String(status ?? "").trim() === "cursor_failed";
}

export type TaskCursorJobSummary = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly cursorRunId?: string | null;
  readonly status: string;
  readonly failureReason?: string | null;
  readonly errorMessage?: string | null;
  readonly lastPollAt?: string | null;
  readonly nextPollAt?: string | null;
  readonly pollCount: number;
  readonly lockedBy?: string | null;
  readonly lockExpiresAt?: string | null;
  readonly completedAt?: string | null;
  readonly execution?: TaskCursorExecutionV1 | null;
}>;

export function toTaskCursorJobSummary(job: {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly cursorRunId?: string | null;
  readonly status: string;
  readonly failureReason?: string | null;
  readonly errorMessage?: string | null;
  readonly lastPollAt?: Date | null;
  readonly nextPollAt?: Date | null;
  readonly pollCount: number;
  readonly lockedBy?: string | null;
  readonly lockExpiresAt?: Date | null;
  readonly completedAt?: Date | null;
  readonly executionJson?: unknown;
}): TaskCursorJobSummary {
  return {
    id: job.id,
    projectId: job.projectId,
    taskId: job.taskId,
    cursorRunId: job.cursorRunId,
    status: job.status,
    failureReason: job.failureReason,
    errorMessage: job.errorMessage,
    lastPollAt: job.lastPollAt?.toISOString() ?? null,
    nextPollAt: job.nextPollAt?.toISOString() ?? null,
    pollCount: job.pollCount,
    lockedBy: job.lockedBy,
    lockExpiresAt: job.lockExpiresAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
