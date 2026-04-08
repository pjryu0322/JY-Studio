import { resolveSessionExecutionLaunchSnapshot } from "@/lib/workflow/preExecutionStateStore";
import type { ActiveExecutionInputSelection } from "@/lib/workflow/preExecutionStateStore";

export type LaunchReadinessResult = {
  isLaunchReady: boolean;
  reasons: string[];
  warnings: string[];
};

export function validateActiveExecutionInput(input: {
  active: ActiveExecutionInputSelection | null;
}): LaunchReadinessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!input.active) {
    reasons.push("No active pre-execution input selected.");
    return { isLaunchReady: false, reasons, warnings };
  }

  const snap = resolveSessionExecutionLaunchSnapshot(input.active.sessionId);
  if (!snap) {
    reasons.push("Active input references a missing snapshot.");
    return { isLaunchReady: false, reasons, warnings };
  }

  if (snap.sessionId !== input.active.sessionId) {
    reasons.push("Snapshot/session relationship is invalid.");
  }

  if (snap.snapshotId !== input.active.snapshotId) {
    reasons.push("Active input snapshot id does not match the current prepared snapshot.");
  }

  if (snap.summary.confirmedCount <= 0) {
    reasons.push("Confirmed task set is empty.");
  }

  if (snap.summary.candidateCount <= 0) {
    reasons.push("Execution candidate set is empty (no ready tasks).");
  }

  if (!snap.sessionId) {
    reasons.push("Session id is missing.");
  }

  if (snap.summary.candidateCount > 0 && snap.summary.confirmedCount > 0 && snap.readyTaskIds.length !== snap.summary.candidateCount) {
    warnings.push("Snapshot readyTaskIds count does not match candidateCount.");
  }

  return { isLaunchReady: reasons.length === 0, reasons, warnings };
}

