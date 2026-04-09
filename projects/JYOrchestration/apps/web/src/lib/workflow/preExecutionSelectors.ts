import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import {
  getActiveExecutionInput,
  isActiveExecutionSnapshot,
  isHandoffPreparedForActive,
  resolveSessionExecutionCandidates,
  resolveSessionExecutionLaunchSnapshot,
  isExecutionDraftApproved,
  resolveSessionExecutionRequestApproval,
  resolveSessionExecutionRequestDraft,
  resolveSessionHandoffPrepared,
  sessionHasExecutionRequestDraft,
  resolveSessionTaskReadiness,
} from "@/lib/workflow/preExecutionStateStore";
import { validateActiveExecutionInput, type LaunchReadinessResult } from "@/lib/workflow/preExecutionValidation";
import {
  evaluateHandoffValidity,
  evaluateSnapshotStaleness,
  type HandoffValidityResult,
  type SnapshotStalenessResult,
} from "@/lib/workflow/preExecutionStaleness";
import { resolveSessionConfirmedTasks } from "@/lib/workflow/collaborationSessionContentStore";
import {
  isBusinessExecutionRequestForSnapshot,
  resolveSessionBusinessExecutionRequest,
  sessionHasBusinessExecutionRequest,
} from "@/lib/workflow/businessExecutionRequestStore";

export type PreExecutionSessionSelector = {
  readinessMap: Record<string, "not_ready" | "ready">;
  candidateTasks: ReturnType<typeof resolveSessionExecutionCandidates>;
  snapshot: ExecutionLaunchSnapshot | undefined;
  active: ReturnType<typeof getActiveExecutionInput>;
  isSnapshotActive: boolean;
  launchReadiness: LaunchReadinessResult;
  handoffPrepared: ReturnType<typeof resolveSessionHandoffPrepared>;
  isHandoffPreparedActive: boolean;
  snapshotStaleness: SnapshotStalenessResult;
  handoffValidity: HandoffValidityResult;
  executionRequestDraft: ReturnType<typeof resolveSessionExecutionRequestDraft>;
  hasExecutionRequestDraft: boolean;
  executionRequestApproval: ReturnType<typeof resolveSessionExecutionRequestApproval>;
  isExecutionDraftApproved: boolean;
  businessExecutionRequest: ReturnType<typeof resolveSessionBusinessExecutionRequest>;
  hasBusinessExecutionRequest: boolean;
  isBusinessExecutionRequestForCurrentSnapshot: boolean;
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
  const confirmed = resolveSessionConfirmedTasks(sessionId) ?? [];
  const snapshotStaleness = evaluateSnapshotStaleness({
    snapshot,
    currentConfirmedTaskIds: confirmed.map((t) => t.id),
    currentCandidateTaskIds: candidateTasks.map((t) => t.id),
    active,
  });
  const handoffValidity = evaluateHandoffValidity({
    launchReadiness,
    staleness: snapshotStaleness,
    active,
    handoffPrepared,
  });
  const executionRequestDraft = resolveSessionExecutionRequestDraft(sessionId);
  const hasExecutionRequestDraft = sessionHasExecutionRequestDraft(sessionId);
  const executionRequestApproval = resolveSessionExecutionRequestApproval(sessionId);
  const isApproved = isExecutionDraftApproved(executionRequestDraft, executionRequestApproval);
  const businessExecutionRequest = resolveSessionBusinessExecutionRequest(sessionId);
  const hasBusinessExecutionRequest = sessionHasBusinessExecutionRequest(sessionId);
  const isBusinessExecutionRequestForCurrentSnapshot = isBusinessExecutionRequestForSnapshot(businessExecutionRequest, snapshot?.snapshotId);
  return {
    readinessMap,
    candidateTasks,
    snapshot,
    active,
    isSnapshotActive,
    launchReadiness,
    handoffPrepared,
    isHandoffPreparedActive,
    snapshotStaleness,
    handoffValidity,
    executionRequestDraft,
    hasExecutionRequestDraft,
    executionRequestApproval,
    isExecutionDraftApproved: isApproved,
    businessExecutionRequest,
    hasBusinessExecutionRequest,
    isBusinessExecutionRequestForCurrentSnapshot,
  };
}

