import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export const TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS = 3 * 60 * 1000;
export const TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS = 15 * 60 * 1000;
export const TASK_CURSOR_STALE_OR_REWORK_AFTER_MS = 30 * 60 * 1000;

const REPEATING_AGENT_STATUSES = new Set(["CREATING", "RUNNING", "PENDING"]);

export function resolveCursorLaunchElapsedMs(
  execution: TaskCursorExecutionV1,
  nowMs: number = Date.now(),
): number | null {
  const started = String(execution.updatedAt ?? execution.createdAt ?? "").trim();
  if (!started) return null;
  const t = Date.parse(started);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, nowMs - t);
}

export function shouldRunTaskCursorGithubFallbackVerify(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly agentStatus?: string | null;
  readonly nowMs?: number;
}): boolean {
  if (input.execution.status !== "cursor_running" && input.execution.status !== "cursor_requested") {
    return false;
  }
  const branch = String(input.execution.workBranch ?? "").trim();
  if (!branch) return false;

  const elapsed = resolveCursorLaunchElapsedMs(input.execution, input.nowMs);
  if (elapsed == null) return false;

  const agent = String(input.agentStatus ?? input.execution.cursorAgentStatus ?? "")
    .trim()
    .toUpperCase();
  if (elapsed >= TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS) return true;
  if (agent && REPEATING_AGENT_STATUSES.has(agent)) return true;
  return false;
}

export function isTaskCursorLongRunningWithoutTerminal(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly nowMs?: number;
}): boolean {
  const elapsed = resolveCursorLaunchElapsedMs(input.execution, input.nowMs);
  return elapsed != null && elapsed >= TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS;
}

export function isTaskCursorStaleByDuration(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly branchDetected: boolean;
  readonly commitDetected: boolean;
  readonly nowMs?: number;
}): boolean {
  const elapsed = resolveCursorLaunchElapsedMs(input.execution, input.nowMs);
  if (elapsed == null || elapsed < TASK_CURSOR_STALE_OR_REWORK_AFTER_MS) return false;
  return !input.branchDetected && !input.commitDetected;
}
