/**
 * Compatibility facade: keep existing imports stable while internally splitting
 * session content overrides vs pre-execution preparation state.
 */

export { subscribeSessionResults as subscribeCollaborationSessionResults } from "@/lib/workflow/sessionResultStoreCore";
export { getSessionResultsVersion as getCollaborationSessionResultsVersion } from "@/lib/workflow/sessionResultStoreCore";

export {
  type SessionCollaborationContentEntry as SessionCollaborationResultEntry,
  getSessionCollaborationEntry,
  recordSessionGeneratedMinutes,
  recordSessionOfficialFeatures,
  recordSessionOfficialTasks,
  recordSessionConfirmedTasks,
  resolveSessionMinutes,
  resolveSessionOfficialFeatures,
  resolveSessionOfficialTasks,
  resolveSessionConfirmedTasks,
  sessionHasMinutesOverride,
  sessionHasOfficialFeaturesOverride,
  sessionHasOfficialTasksOverride,
  sessionHasConfirmedTaskSet,
} from "@/lib/workflow/collaborationSessionContentStore";

export {
  type TaskExecutionReadiness,
  type HandoffPreparedState,
  getTaskExecutionReadiness,
  resolveSessionTaskReadiness,
  setSessionTaskReadiness,
  resolveSessionExecutionCandidates,
  recordSessionExecutionLaunchSnapshot,
  resolveSessionExecutionLaunchSnapshot,
  sessionHasExecutionLaunchSnapshot,
  recordSessionHandoffPrepared,
  resolveSessionHandoffPrepared,
  isHandoffPreparedForActive,
  recordSessionExecutionRequestDraft,
  resolveSessionExecutionRequestDraft,
  sessionHasExecutionRequestDraft,
  recordSessionExecutionRequestApproval,
  resolveSessionExecutionRequestApproval,
  isExecutionDraftApproved,
  type ActiveExecutionInputSelection,
  getActiveExecutionInput,
  setActiveExecutionInput,
  isActiveExecutionSnapshot,
} from "@/lib/workflow/preExecutionStateStore";

export {
  recordSessionBusinessExecutionRequest,
  resolveSessionBusinessExecutionRequest,
  sessionHasBusinessExecutionRequest,
  isBusinessExecutionRequestForSnapshot,
} from "@/lib/workflow/businessExecutionRequestStore";
