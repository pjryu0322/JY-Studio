import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { isCursorCloudAgentRunId, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

/** Agent id 반영·첫 poll 전 Recovery 유예 (server polling) */
export const IMPLEMENTATION_RUNTIME_LAUNCH_GRACE_MS = 180_000 as const;

export function isWithinImplementationRuntimeLaunchGrace(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly anchorIso?: string | null;
  readonly nowMs?: number;
  readonly graceMs?: number;
}): boolean {
  const graceMs = input.graceMs ?? IMPLEMENTATION_RUNTIME_LAUNCH_GRACE_MS;
  const nowMs = input.nowMs ?? Date.now();
  const anchor = String(
    input.anchorIso ?? input.execution?.updatedAt ?? input.execution?.createdAt ?? "",
  ).trim();
  if (!anchor) return false;
  const anchorMs = Date.parse(anchor);
  if (!Number.isFinite(anchorMs)) return false;
  return nowMs - anchorMs < graceMs;
}

export function shouldDeferRuntimeRecoveryForLaunchGrace(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly pollCount?: number;
  readonly serverPolling?: boolean;
  readonly nowMs?: number;
}): boolean {
  const serverPolling = input.serverPolling ?? isServerTaskCursorPolling();
  if (!serverPolling) return false;
  const pollCount = input.pollCount ?? 0;
  if (pollCount > 0) return false;
  return isWithinImplementationRuntimeLaunchGrace({
    execution: input.execution,
    nowMs: input.nowMs,
  });
}

export function isMissingCursorAgentIdDuringLaunchGrace(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly pollCount?: number;
  readonly serverPolling?: boolean;
  readonly nowMs?: number;
}): boolean {
  const execution = input.execution;
  if (!execution) return false;
  if (execution.status !== "cursor_running" && execution.status !== "cursor_requested") {
    return false;
  }
  if (isCursorCloudAgentRunId(execution.cursorRunId)) return false;
  return shouldDeferRuntimeRecoveryForLaunchGrace(input);
}
