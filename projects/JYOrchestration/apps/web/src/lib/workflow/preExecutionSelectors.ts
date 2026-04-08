import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import {
  getActiveExecutionInput,
  isActiveExecutionSnapshot,
  resolveSessionExecutionCandidates,
  resolveSessionExecutionLaunchSnapshot,
  resolveSessionTaskReadiness,
} from "@/lib/workflow/preExecutionStateStore";

export type PreExecutionSessionSelector = {
  readinessMap: Record<string, "not_ready" | "ready">;
  candidateTasks: ReturnType<typeof resolveSessionExecutionCandidates>;
  snapshot: ExecutionLaunchSnapshot | undefined;
  active: ReturnType<typeof getActiveExecutionInput>;
  isSnapshotActive: boolean;
};

export function getPreExecutionStateForSession(sessionId: string | null | undefined): PreExecutionSessionSelector {
  const readinessMap = resolveSessionTaskReadiness(sessionId);
  const candidateTasks = resolveSessionExecutionCandidates(sessionId);
  const snapshot = resolveSessionExecutionLaunchSnapshot(sessionId);
  const active = getActiveExecutionInput();
  const isSnapshotActive = isActiveExecutionSnapshot(sessionId, snapshot?.snapshotId);
  return { readinessMap, candidateTasks, snapshot, active, isSnapshotActive };
}

