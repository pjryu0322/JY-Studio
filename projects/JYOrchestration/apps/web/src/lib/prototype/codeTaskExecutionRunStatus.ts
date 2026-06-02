import type { CodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRun";

const IN_FLIGHT = new Set<CodeTaskExecutionRunStatus>([
  "queued",
  "prompt_building",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

const TERMINAL = new Set<CodeTaskExecutionRunStatus>([
  "completed",
  "no_code_change_completed",
  "rework_required",
  "failed",
]);

export function isInFlightCodeTaskExecutionRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return IN_FLIGHT.has(status);
}

export function isTerminalCodeTaskExecutionRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return TERMINAL.has(status);
}

export function isQueueContinueAfterRunStatus(status: CodeTaskExecutionRunStatus): boolean {
  return (
    status === "completed" ||
    status === "no_code_change_completed" ||
    status === "rework_required" ||
    status === "failed"
  );
}
