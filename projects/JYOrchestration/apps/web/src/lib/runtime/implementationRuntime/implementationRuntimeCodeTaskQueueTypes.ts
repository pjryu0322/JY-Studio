export type ImplementationRuntimeCodeTaskQueueItemStatus =
  | "queued"
  | "dispatching"
  | "cursor_requested"
  | "cursor_running"
  | "github_verifying"
  | "completed"
  | "no_code_change_completed"
  | "rework_required"
  | "failed"
  | "blocked_by_dependency"
  | "skipped";

export const IMPLEMENTATION_RUNTIME_QUEUE_ITEM_IN_FLIGHT: ReadonlySet<string> = new Set([
  "dispatching",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

export const IMPLEMENTATION_RUNTIME_QUEUE_ITEM_TERMINAL: ReadonlySet<string> = new Set([
  "completed",
  "no_code_change_completed",
  "rework_required",
  "failed",
  "blocked_by_dependency",
  "skipped",
]);

export function isImplementationRuntimeQueueItemInFlight(status: string): boolean {
  return IMPLEMENTATION_RUNTIME_QUEUE_ITEM_IN_FLIGHT.has(status);
}

export function isImplementationRuntimeQueueItemTerminal(status: string): boolean {
  return IMPLEMENTATION_RUNTIME_QUEUE_ITEM_TERMINAL.has(status);
}

export type ImplementationRuntimeCodeTaskQueueItemView = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly jobId: string;
  readonly queueOrder: number;
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItemId: string | null;
  readonly status: ImplementationRuntimeCodeTaskQueueItemStatus;
  readonly attemptNo: number;
  readonly commitSha: string | null;
  readonly failureReason: string | null;
  readonly updatedAt: string;
}>;
