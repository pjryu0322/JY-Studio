import type { CodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRun";

/** queued는 대기 상태 — 실행 중이 아님 */
const QUEUED_WAIT = new Set<CodeTaskExecutionRunStatus>(["queued"]);

/** Runtime 실행 중: dispatching / cursor_running / github_verifying 에 대응 */
const RUNTIME_ACTIVE = new Set<CodeTaskExecutionRunStatus>([
  "prompt_building",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

const IN_FLIGHT = new Set<CodeTaskExecutionRunStatus>([...QUEUED_WAIT, ...RUNTIME_ACTIVE]);

const TERMINAL = new Set<CodeTaskExecutionRunStatus>([
  "completed",
  "no_code_change_completed",
  "rework_required",
  "status_check_stopped",
  "blocked_by_dependency",
  "failed",
  "skipped_by_user",
]);

export function isInFlightCodeTaskExecutionRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return IN_FLIGHT.has(status);
}

export function isRuntimeActiveCodeTaskExecutionRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return RUNTIME_ACTIVE.has(status);
}

export function isQueuedCodeTaskExecutionRunStatus(status: CodeTaskExecutionRunStatus): boolean {
  return QUEUED_WAIT.has(status);
}

export function isTerminalCodeTaskExecutionRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return TERMINAL.has(status);
}

export function isQueueIssueRunStatus(status: CodeTaskExecutionRunStatus): boolean {
  return (
    status === "rework_required" ||
    status === "failed" ||
    status === "status_check_stopped"
  );
}

export function isQueueContinueAfterRunStatus(status: CodeTaskExecutionRunStatus): boolean {
  return (
    status === "completed" ||
    status === "no_code_change_completed" ||
    status === "rework_required" ||
    status === "status_check_stopped" ||
    status === "blocked_by_dependency" ||
    status === "failed" ||
    status === "skipped_by_user"
  );
}
