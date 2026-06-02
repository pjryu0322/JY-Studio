import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { isRuntimeInFlight } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

const ALLOWED: Readonly<Record<RuntimeState, readonly RuntimeState[]>> = {
  idle: ["queued"],
  queued: ["dispatching", "failed", "stale"],
  dispatching: ["cursor_running", "failed", "stale"],
  cursor_running: ["github_verifying", "failed", "stale"],
  github_verifying: ["completed", "failed"],
  completed: [],
  failed: ["queued"],
  stale: ["queued"],
};

export class ImplementationRuntimeTransitionError extends Error {
  readonly from: RuntimeState;
  readonly to: RuntimeState;

  constructor(from: RuntimeState, to: RuntimeState) {
    super(`Invalid runtime transition: ${from} → ${to}`);
    this.name = "ImplementationRuntimeTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransitionRuntimeState(from: RuntimeState, to: RuntimeState): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertRuntimeTransition(from: RuntimeState, to: RuntimeState): void {
  if (!canTransitionRuntimeState(from, to)) {
    throw new ImplementationRuntimeTransitionError(from, to);
  }
}

export function isTerminalRuntimeState(state: RuntimeState): boolean {
  return state === "completed" || state === "failed" || state === "stale";
}

export function resolveJobStatusFromRuns(
  runs: readonly { readonly runtimeState: RuntimeState }[],
  jobStatus: string,
): "running" | "paused" | "completed" | "completed_with_issues" | "failed" | "idle" {
  if (jobStatus === "paused") return "paused";
  if (jobStatus === "failed") return "failed";
  if (jobStatus === "completed") return "completed";
  if (jobStatus === "completed_with_issues") return "completed_with_issues";
  if (runs.some((r) => isRuntimeInFlight(r.runtimeState))) return "running";
  if (runs.some((r) => r.runtimeState === "queued")) return "running";
  if (runs.length && runs.every((r) => r.runtimeState === "completed")) return "completed";
  if (runs.some((r) => r.runtimeState === "failed" || r.runtimeState === "stale")) {
    return runs.some((r) => r.runtimeState === "completed") ? "completed_with_issues" : "failed";
  }
  return jobStatus === "running" ? "running" : "idle";
}
