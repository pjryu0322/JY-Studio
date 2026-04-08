import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import {
  getActiveExecutionInput,
  isActiveExecutionSnapshot,
  isHandoffPreparedForActive,
  resolveSessionExecutionCandidates,
  resolveSessionExecutionLaunchSnapshot,
  resolveSessionHandoffPrepared,
  resolveSessionTaskReadiness,
} from "@/lib/workflow/preExecutionStateStore";
import { validateActiveExecutionInput, type LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";

export type PreExecutionSessionSelector = {
  readinessMap: Record<string, "not_ready" | "ready">;
  candidateTasks: ReturnType<typeof resolveSessionExecutionCandidates>;
  snapshot: ExecutionLaunchSnapshot | undefined;
  active: ReturnType<typeof getActiveExecutionInput>;
  isSnapshotActive: boolean;
  launchReadiness: LaunchReadinessResult;
  handoffPrepared: ReturnType<typeof resolveSessionHandoffPrepared>;
  isHandoffPreparedActive: boolean;
};

export function getPreExecutionStateForSession(sessionId: string | null | undefined): PreExecutionSessionSelector {
  const readinessMap = resolveSessionTaskReadiness(sessionId);
  const candidateTasks = resolveSessionExecutionCandidates(sessionId);
  const snapshot = resolveSessionExecutionLaunchSnapshot(sessionId);
  const active = getActiveExecutionInput();
  const isSnapshotActive = isActiveExecutionSnapshot(sessionId, snapshot?.snapshotId);
  const launchReadiness = validateActiveExecutionInput({ active });
  const handoffPrepared = resolveSessionHandoffPrepared(sessionId);
  const isHandoffPreparedActive = isHandoffPreparedForActive(active, handoffPrepared);
  return {
    readinessMap,
    candidateTasks,
    snapshot,
    active,
    isSnapshotActive,
    launchReadiness,
    handoffPrepared,
    isHandoffPreparedActive,
  };
}

