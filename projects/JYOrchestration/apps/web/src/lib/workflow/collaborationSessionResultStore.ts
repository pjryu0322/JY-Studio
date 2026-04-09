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
  recordSessionBusinessExecutionApproval,
  resolveSessionBusinessExecutionApproval,
  sessionHasBusinessExecutionApproval,
  recordSessionBusinessExecutionPackage,
  resolveSessionBusinessExecutionPackage,
  sessionHasBusinessExecutionPackage,
  recordSessionExecutionAssignment,
  resolveSessionExecutionAssignment,
  sessionHasExecutionAssignment,
  recordSessionExecutionAssignmentHandoffPayload,
  resolveSessionExecutionAssignmentHandoffPayload,
  sessionHasExecutionAssignmentHandoffPayload,
  recordSessionExecutorIntakeContract,
  resolveSessionExecutorIntakeContract,
  sessionHasExecutorIntakeContract,
  recordSessionExecutorWorkOrder,
  resolveSessionExecutorWorkOrder,
  sessionHasExecutorWorkOrder,
  recordSessionBusinessLaunchIntent,
  resolveSessionBusinessLaunchIntent,
  sessionHasBusinessLaunchIntent,
  recordSessionBusinessLaunchHandoffRecord,
  resolveSessionBusinessLaunchHandoffRecord,
  sessionHasBusinessLaunchHandoffRecord,
  recordSessionExecutionBridgePayload,
  resolveSessionExecutionBridgePayload,
  sessionHasExecutionBridgePayload,
  recordSessionExecutorLaunchContract,
  resolveSessionExecutorLaunchContract,
  sessionHasExecutorLaunchContract,
  recordSessionExecutionTriggerIntent,
  resolveSessionExecutionTriggerIntent,
  sessionHasExecutionTriggerIntent,
  recordSessionActualExecutionAdapterRequest,
  resolveSessionActualExecutionAdapterRequest,
  sessionHasActualExecutionAdapterRequest,
  evaluateExecutionRequestValidity,
  resolveExecutionRequestValidity,
  type ExecutionRequestLifecycleStatus,
  type ExecutionRequestValidityResult,
} from "@/lib/workflow/businessExecutionRequestStore";

export {
  approveBusinessExecutionRequest,
  isBusinessApprovalForRequest,
  type BusinessExecutionApproval,
} from "@/lib/workflow/businessExecutionApproval";

export {
  resolveBusinessExecutionApproval,
  isCurrentBusinessExecutionRequestApproved,
  getBusinessExecutionApprovalStateForSession,
} from "@/lib/workflow/businessExecutionGate";

export {
  createBusinessExecutionPackage,
  isBusinessPackageForApprovedRequest,
  type BusinessExecutionPackage,
} from "@/lib/workflow/businessExecutionPackage";

export {
  resolveBusinessExecutionPackage,
  isCurrentBusinessExecutionPackage,
  getBusinessExecutionPackageStateForSession,
} from "@/lib/workflow/businessExecutionPackageGate";

export {
  assignBusinessExecutionPackage,
  EXECUTION_EXECUTOR_TYPES,
  EXECUTOR_TYPE_LABELS,
  isExecutionAssignmentForPackage,
  type ExecutionAssignment,
  type ExecutionExecutorType,
} from "@/lib/workflow/executionAssignment";

export {
  resolveExecutionAssignment,
  isCurrentExecutionPackageAssigned,
  getExecutionAssignmentStateForSession,
} from "@/lib/workflow/executionAssignmentGate";

export {
  createExecutionAssignmentHandoff,
  isExecutionAssignmentHandoffPayloadForAssignment,
  type ExecutionAssignmentHandoffPayload,
} from "@/lib/workflow/executionAssignmentHandoffPayload";

export {
  resolveExecutionAssignmentHandoff,
  isCurrentExecutionAssignmentHandoff,
  getExecutionHandoffStateForSession,
} from "@/lib/workflow/executionAssignmentHandoffGate";

export {
  createExecutorIntakeContract,
  executorIntakePreviewLine,
  isExecutorIntakeContractForHandoff,
  shapeExecutorIntakePayload,
  type ExecutorIntakeContract,
  type ExecutorIntakeShapedPayload,
} from "@/lib/workflow/executorIntakeContract";

export {
  resolveExecutorIntakeContract,
  isCurrentExecutorIntakeContract,
  getExecutorIntakeStateForSession,
} from "@/lib/workflow/executorIntakeGate";

export {
  createExecutorWorkOrder,
  isExecutorWorkOrderForIntake,
  shapeExecutorWorkOrder,
  truncateWorkOrderPreview,
  type ExecutorWorkOrder,
  type ExecutorWorkOrderShapedFields,
} from "@/lib/workflow/executorWorkOrder";

export {
  resolveExecutorWorkOrder,
  isCurrentExecutorWorkOrder,
  getExecutorWorkOrderStateForSession,
} from "@/lib/workflow/executorWorkOrderGate";

export {
  evaluateExecutionReadiness,
  noSessionExecutionReadiness,
  resolveExecutionReadiness,
  resolveExecutionReadinessForSession,
  EXECUTION_READINESS_UI_REASONS_MAX,
  type ExecutionReadiness,
  type ExecutionReadinessStatus,
} from "@/lib/workflow/executionReadiness";

export {
  declareBusinessLaunchIntent,
  isBusinessLaunchIntentCurrent,
  type BusinessLaunchIntent,
} from "@/lib/workflow/businessLaunchIntent";

export {
  resolveBusinessLaunchIntent,
  isCurrentBusinessLaunchIntent,
  getBusinessLaunchIntentStateForSession,
} from "@/lib/workflow/businessLaunchIntentGate";

export {
  createBusinessLaunchHandoffRecord,
  isBusinessLaunchHandoffRecordCurrent,
  type BusinessLaunchHandoffRecord,
} from "@/lib/workflow/businessLaunchHandoffRecord";

export {
  resolveBusinessLaunchHandoffRecord,
  isCurrentBusinessLaunchHandoffRecord,
  getBusinessLaunchHandoffStateForSession,
} from "@/lib/workflow/businessLaunchHandoffGate";

export {
  buildExecutionContext,
  createExecutionBridgePayload,
  isExecutionBridgePayloadCurrent,
  type ExecutionBridgeContext,
  type ExecutionBridgePayload,
} from "@/lib/workflow/executionBridgePayload";

export {
  resolveExecutionBridgePayload,
  isCurrentExecutionBridgePayload,
  getExecutionBridgeStateForSession,
} from "@/lib/workflow/executionBridgeGate";

export {
  createExecutorLaunchContract,
  shapeExecutorLaunchContract,
  isExecutorLaunchContractCurrent,
  executorLaunchContractContextSummary,
  executorLaunchHintsPreview,
  type ExecutorLaunchContract,
  type ExecutorLaunchHints,
} from "@/lib/workflow/executorLaunchContract";

export {
  resolveExecutorLaunchContract,
  isCurrentExecutorLaunchContract,
  getExecutorLaunchContractStateForSession,
} from "@/lib/workflow/executorLaunchContractGate";

export {
  declareExecutionTriggerIntent,
  isExecutionTriggerIntentCurrent,
  type ExecutionTriggerIntent,
} from "@/lib/workflow/executionTriggerIntent";

export {
  resolveExecutionTriggerIntent,
  isCurrentExecutionTriggerIntent,
  getExecutionTriggerIntentStateForSession,
} from "@/lib/workflow/executionTriggerIntentGate";

export {
  createActualExecutionAdapterRequest,
  shapeActualExecutionAdapterPayload,
  isActualExecutionAdapterRequestCurrent,
  actualExecutionAdapterPayloadSummary,
  actualExecutionAdapterExecutorHintPreview,
  type ActualExecutionAdapterPayload,
  type ActualExecutionAdapterRequest,
} from "@/lib/workflow/actualExecutionAdapter";

export {
  resolveActualExecutionAdapterRequest,
  isCurrentActualExecutionAdapterRequest,
  getActualExecutionAdapterStateForSession,
} from "@/lib/workflow/actualExecutionAdapterGate";
