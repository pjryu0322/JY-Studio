import type { TaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import { buildTaskCursorAutoChainTriggerKey } from "@/lib/prototype/implementationTaskCursorAutoChain";

export function buildTaskCursorAutoChainIdempotencyKey(input: {
  readonly projectId: string;
  readonly decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>;
  readonly activeRunId?: string | null;
}): string {
  const projectId = input.projectId.trim();
  const runId = String(input.activeRunId ?? "").trim() || "none";
  if (input.decision.kind === "continue_after_failure") {
    return `${projectId}:${input.decision.failedTaskId}:${input.decision.toTaskId}:${runId}`;
  }
  if (input.decision.kind === "continue") {
    return `${projectId}:${input.decision.fromTaskId}:${input.decision.toTaskId}:${runId}`;
  }
  return `${projectId}:start:${input.decision.taskId}:${runId}`;
}

export function hasTaskCursorAutoChainIdempotencyKey(
  executedKeys: ReadonlySet<string>,
  key: string,
): boolean {
  return executedKeys.has(key);
}

export function rememberTaskCursorAutoChainIdempotencyKey(
  executedKeys: Set<string>,
  key: string,
): void {
  executedKeys.add(key);
}

export function resolveTaskCursorAutoChainTriggerDedupeKey(input: {
  readonly projectId: string;
  readonly decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>;
  readonly activeRunId?: string | null;
}): string {
  return `${buildTaskCursorAutoChainTriggerKey(input.decision)}|${buildTaskCursorAutoChainIdempotencyKey(input)}`;
}
