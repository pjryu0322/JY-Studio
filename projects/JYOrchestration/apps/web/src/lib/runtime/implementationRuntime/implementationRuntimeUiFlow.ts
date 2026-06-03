import {
  isRuntimeInFlight,
  type RuntimeState,
} from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export function hasDbImplementationRuntimeJob(
  bundle: ImplementationRuntimeBundleView | null | undefined,
): boolean {
  return Boolean(bundle?.job?.id);
}

export function shouldPollImplementationRuntime(input: {
  readonly bundle: ImplementationRuntimeBundleView | null | undefined;
  readonly legacyQueueRunning: boolean;
  readonly legacyCursorInFlight: boolean;
}): boolean {
  const job = input.bundle?.job;
  if (job?.status === "running" || job?.status === "paused") return true;
  if (isRuntimeInFlight(input.bundle?.currentRun?.runtimeState)) return true;
  if (input.legacyQueueRunning || input.legacyCursorInFlight) return true;
  return false;
}

export function resolveDbPreferredRuntimeState(
  bundle: ImplementationRuntimeBundleView | null | undefined,
): RuntimeState | null {
  if (!hasDbImplementationRuntimeJob(bundle)) return null;
  return bundle?.currentRun?.runtimeState ?? null;
}
