/**
 * Compatibility facade for business-side pre-execution workflow state (NOT Stage1/Stage2).
 *
 * Stage1/Stage2 are environment/integration/procedure test flows.
 * This module is for business execution preparation artifacts only.
 */

export {
  type TaskExecutionReadiness,
  getTaskExecutionReadiness,
  resolveSessionTaskReadiness,
  setSessionTaskReadiness,
  resolveSessionExecutionCandidates,
  recordSessionExecutionLaunchSnapshot,
  resolveSessionExecutionLaunchSnapshot,
  sessionHasExecutionLaunchSnapshot,
} from "@/lib/workflow/preExecutionPreparationStore";

export {
  type ActiveExecutionInputSelection,
  getActiveExecutionInput,
  setActiveExecutionInput,
  isActiveExecutionSnapshot,
} from "@/lib/workflow/preExecutionActiveInputStore";

export {
  type HandoffPreparedState,
  recordSessionHandoffPrepared,
  resolveSessionHandoffPrepared,
  isHandoffPreparedForActive,
  recordSessionExecutionRequestDraft,
  resolveSessionExecutionRequestDraft,
  sessionHasExecutionRequestDraft,
  recordSessionExecutionRequestApproval,
  resolveSessionExecutionRequestApproval,
  isExecutionDraftApproved,
} from "@/lib/workflow/preExecutionHandoffStore";

