import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import type { ActiveExecutionInputSelection, HandoffPreparedState } from "@/lib/workflow/preExecutionStateStore";
import type { LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";

export type SnapshotStalenessResult = {
  isSnapshotStale: boolean;
  staleReason?: string;
  comparedAtIso: string;
};

export type HandoffValidityResult = {
  isHandoffValid: boolean;
  invalidReason?: string;
};

function normalizeIds(ids: string[]): string[] {
  return [...ids].filter(Boolean).sort();
}

function sameIdSet(a: string[], b: string[]): boolean {
  const aa = normalizeIds(a);
  const bb = normalizeIds(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

export function evaluateSnapshotStaleness(input: {
  snapshot: ExecutionLaunchSnapshot | undefined;
  currentConfirmedTaskIds: string[];
  currentCandidateTaskIds: string[];
  active: ActiveExecutionInputSelection | null;
}): SnapshotStalenessResult {
  const comparedAtIso = new Date().toISOString();

  if (!input.snapshot) {
    return { isSnapshotStale: true, staleReason: "Prepared snapshot is missing.", comparedAtIso };
  }

  if (input.active && input.active.snapshotId !== input.snapshot.snapshotId) {
    return { isSnapshotStale: true, staleReason: "Active input points to a different snapshot.", comparedAtIso };
  }

  if (!sameIdSet(input.currentConfirmedTaskIds, input.snapshot.confirmedTaskIds)) {
    return { isSnapshotStale: true, staleReason: "Confirmed task set changed since snapshot.", comparedAtIso };
  }

  if (!sameIdSet(input.currentCandidateTaskIds, input.snapshot.readyTaskIds)) {
    return { isSnapshotStale: true, staleReason: "Execution candidates changed since snapshot.", comparedAtIso };
  }

  return { isSnapshotStale: false, comparedAtIso };
}

export function evaluateHandoffValidity(input: {
  launchReadiness: LaunchReadinessResult;
  staleness: SnapshotStalenessResult;
  active: ActiveExecutionInputSelection | null;
  handoffPrepared: HandoffPreparedState | undefined;
}): HandoffValidityResult {
  if (!input.handoffPrepared) {
    return { isHandoffValid: false, invalidReason: "Handoff is not prepared." };
  }

  if (!input.active) {
    return { isHandoffValid: false, invalidReason: "No active input selected for handoff." };
  }

  if (input.handoffPrepared.sessionId !== input.active.sessionId || input.handoffPrepared.snapshotId !== input.active.snapshotId) {
    return { isHandoffValid: false, invalidReason: "Handoff does not match the current active input." };
  }

  if (!input.launchReadiness.isLaunchReady) {
    return { isHandoffValid: false, invalidReason: "Active input is not launch-ready." };
  }

  if (input.staleness.isSnapshotStale) {
    return { isHandoffValid: false, invalidReason: input.staleness.staleReason ?? "Snapshot is stale." };
  }

  return { isHandoffValid: true };
}

