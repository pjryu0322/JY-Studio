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
  getTaskExecutionReadiness,
  resolveSessionTaskReadiness,
  setSessionTaskReadiness,
  resolveSessionExecutionCandidates,
  recordSessionExecutionLaunchSnapshot,
  resolveSessionExecutionLaunchSnapshot,
  sessionHasExecutionLaunchSnapshot,
  type ActiveExecutionInputSelection,
  getActiveExecutionInput,
  setActiveExecutionInput,
  isActiveExecutionSnapshot,
} from "@/lib/workflow/preExecutionStateStore";
