"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  buildPrototypeChatMessages,
  buildTimelineArchiveMessages,
  isPrototypeDeployPhase,
  mergeTimelineArchiveIntoLive,
  type PrototypeChatAction,
  type PrototypePrePlanGate,
} from "@/lib/prototype/buildPrototypeChatMessages";
import {
  PrototypeExecutionChatPanel,
  PROTOTYPE_INLINE_TEMPLATE_AI_VALUE,
} from "@/components/preview/PrototypeExecutionChatPanel";
import { ImplementationExecutionBoardPanel } from "@/components/preview/ImplementationExecutionBoardPanel";
import { ImplementationStageNoticeModal } from "@/components/preview/ImplementationStageNoticeModal";
import { ImplementationStageGlobalToolbar } from "@/components/preview/ImplementationStageGlobalToolbar";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { useImplementationToolbarMobileBreakpoint } from "@/components/ui/breakpoints";

import type { ArtifactBoardAction } from "@/lib/artifacts/buildArtifactBoardItems";
import { RecommendationEvidenceDrawer } from "@/components/recommendation/RecommendationEvidenceDrawer";
import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import { buildArtifactHubBundle } from "@/lib/requirements/artifactHubBundle";
import { DB_INTEGRATION_REVIEW_CHIP } from "@/lib/prototype/implementationDbStrategy";
import {
  buildImplementationArtifactsTimelineEntry,
  derivedHubEntryToDeliverableAsset,
} from "@/lib/prototype/implementationArtifacts";
import {
  buildImplementationSlotsInterviewUi,
  overlayImplementationInterviewUiWithTaskExecutionProgress,
} from "@/lib/prototype/prototypeExecutionImplementationChrome";
import { resolvePrototypeExecutionActivityStatus } from "@/lib/prototype/prototypeExecutionActivityStatus";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  IMPLEMENTATION_ARTIFACT_HUB_LABEL,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_PROGRESS_LABEL,
  IMPLEMENTATION_QUICK_RUN_CHIP,
  IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import { RequirementsArtifactHubDrawer } from "@/components/requirements/RequirementsArtifactHubDrawer";
import { RequirementsDeliverableViewerModal } from "@/components/requirements/RequirementsDeliverableViewerModal";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import {
  IMPLEMENTATION_MODE_PARTICIPANT_COUNT,
  IMPLEMENTATION_MODE_PRIMARY_MEMBERS,
} from "@/lib/requirements/modeOrchestrationConfig";
import {
  buildImplementationBootstrapInput,
  isPrototypeExecutionEnvLoading,
  pickExecutionStateArtifacts,
  toPrototypeChatEnvSnapshot,
} from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import {
  buildCodeAgentWipDraftCreatedTimelineEntry,
  buildCodeAgentWipDraftFailedTimelineEntry,
  buildImplementationWipDraftLifecycleTimelineEntry,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  mapBlockedMessageToWipDraftFailureReason,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  buildCursorBridgeApiBlockedResult,
  buildCursorBridgeOrchestrationResult,
  patchWipForCursorBridgePhase,
} from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import {
  resolveCodeAgentWipForFinalScmIntegratedStage,
  validateFinalScmIntegratedStageReadiness,
  prepareCodeAgentWipForFinalScmIntegratedStage,
  isFinalScmPlatformExecutionCompleted,
  buildFinalScmIntegratedStageStartedNotice,
  buildFinalScmIntegratedStageCompletedNotice,
  buildFinalScmIntegratedStageFailedNotice,
} from "@/lib/prototype/implementationFinalScmIntegratedStage";
import {
  buildPlatformScmOrchestrationPatchFromPersist,
  fetchPlatformScmExecutePersistPatch,
  fetchPlatformScmMergePersistPatch,
  shouldAttemptAutoPlatformScmMerge,
  validatePlatformScmMergeStepReadiness,
  type PlatformScmExecutePersistPatch,
  type PlatformScmMergePersistPatch,
} from "@/lib/prototype/prototypePlatformScmPanelClient";
import { fetchExecutionSetup } from "@/components/project-spec/api";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupDtoToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  buildExecutionSetupAvailabilityFingerprint,
  buildExecutionSetupAvailabilityTimelineEntry,
  evaluateCursorExecutionAvailability,
} from "@/lib/prototype/cursorExecutionAvailability";
import { resolveTaskCursorExecutionEnvGate } from "@/lib/prototype/implementationBoardEnvDetailView";
import {
  buildQualityGateBridgeTargetFromTaskCursor,
  buildQualityGateBridgeTargetFromWip,
} from "@/lib/prototype/bridgeCompletionPolicy";
import {
  buildTargetRepoE2eTimelineEntry,
  buildCursorApiDirectTimelineEntry,
  formatTargetRepoE2eDiagnosticLines,
  isCursorBridgeConfiguredForSourceGeneration,
} from "@/lib/prototype/targetRepoE2eDiagnostics";
import { CURSOR_API_NOT_CONFIGURED_MESSAGE } from "@/lib/prototype/cursorExecutionAvailability";
import { toCodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import {
  buildWipChipHandlerSlice,
  executeCodeAgentWipWorkRequest,
} from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import {
  buildDataModelDraftResult,
  buildDbIntegrationReviewResult,
  buildMockImplementationModeResult,
} from "@/lib/prototype/prototypeExecutionDbStrategyActions";
import {
  ensureImplementationArtifactsFromTaskList,
  ensureImplementationTaskPlan,
  ensureMockImplementationReady,
} from "@/lib/prototype/implementationAutoProgress";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import { buildPlanningImplementationSeedCheckResult } from "@/lib/requirements/planningImplementationSeedActions";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  mapImplementationChipToAction,
  mergePendingImplementationPatch,
  mergePendingImplementationPatchFromOrchestration,
  resolveOrchestrationAwareRequirementsState,
  resolveEffectiveImplementationState,
  shouldClearPendingImplementationPatch,
  type ImplementationStageActionId,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { hasActiveImplementationExecutionSession } from "@/lib/requirements/resetDerivedImplementationState";
import {
  buildImplementationStageActionFocusComposerResult,
  buildImplementationStageActionOpenArtifactsResult,
  buildImplementationStageActionOpenEnvSettingsResult,
  buildImplementationStageActionShowStatusResult,
  type ImplementationStageActionExecutionResult,
  type ImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionPipeline";
import { orchestrateImplementationStageAction } from "@/lib/prototype/implementationStageActionOrchestrator";
import {
  buildImplementationStageActionClickedTimelineEntry,
  resolveImplementationStageActionClick,
  type ImplementationStageActionClickInput,
  type ImplementationStageActionClickSource,
} from "@/lib/prototype/implementationStageActionBinding";
import {
  buildImplementationStageActionRunLogPatch,
  type ImplementationStageActionRun,
} from "@/lib/prototype/implementationStageActionRun";
import { prioritizeImplementationChipsForState, deriveImplementationStageNextActions } from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  buildConfirmImplementationTaskPlanResult,
  buildImplementationCursorGateContext,
  buildPrepareImplementationExecutionToast,
  evaluateImplementationCursorGate,
  formatImplementationCursorBlockedNotice,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildPromptTimelineEntryFingerprint } from "@/lib/requirements/promptTimelineState";
import {
  appendPromptTimeline,
  buildPrototypeExecutionOrchestrationPersistPatch,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildImplementationRoleCheckSummary,
  buildImplementationStatusQueryMessage,
  buildImplementationStatusQueryTimelineEntry,
  hasImplementationRoleCheckDetailsShown,
  implementationEntryChipsForBootstrap,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { resolveImplementationOperationalSend } from "@/lib/prototype/implementationOperationalSend";
import {
  appendCreateWorkPlanBootstrapCtaRouteTimeline,
  mergePromptTimelineWithBootstrapEntries,
} from "@/lib/prototype/implementationIntentTimeline";
import { buildImplementationUserFeedbackOrchestrationPatch } from "@/lib/prototype/implementationUserFeedback";
import { summarizeImplementationSeedStatus } from "@/lib/requirements/implementationSeed";
import { buildGenerateImplementationTaskListFromSeedResult } from "@/lib/prototype/implementationTaskListGeneration";
import {
  postImplementationPrepSync,
  postQuickDesignConfirm,
} from "@/components/project-spec/apis/quickDesignConfirmApi";
import {
  buildCreateImplementationSeedFromQuickDesignDraftResult,
} from "@/lib/prototype/implementationQuickDesignDraftBridge";
import {
  buildImplementationEntryCursorWorkItemsRecovery,
  buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry,
  deriveImplementationEntryState,
} from "@/lib/prototype/implementationEntryState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildIntegratedStageStepActionNotice,
  buildReworkRequestRegistrationNotice,
  countTaskListWipCandidateTasks,
  formatTaskScopedWipExecutionBlockedNotice,
  isImplementationReadyForReviewStage,
  pickFirstExecutableDeveloperTaskId,
  pickQualityGateTargetTaskIds,
  pickTaskIdForReworkRequest,
  resolveTaskRowUserRestartCapability,
  selectCursorWorkItemsForWipExecution,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  mergeIntegrationPullRequestClient,
} from "@/lib/prototype/implementationIntegrationClient";
import { runProjectIntegrationPrepareOnly } from "@/lib/prototype/projectIntegrationPipelineClient";
import { ensureCompletedCodeTaskPreviewForFallback } from "@/lib/prototype/completedCodeTaskPreviewBuildService";
import {
  shouldRunCompletedCodeTaskPreviewFallbackOnOpen,
} from "@/lib/prototype/completedCodeTaskPreviewFallback";
import {
  buildCodeTaskPreviewFallbackUrl,
  isLegacyCodeTaskPreviewScopeNoticeContent,
  sanitizeIntegratedAppPreviewUrl,
  type ImplementationPreviewEntryModeV1,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import {
  COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION,
} from "@/lib/prototype/implementationPreviewActionSource";
import {
  INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE,
  toUserSafeIntegrationErrorMessage,
} from "@/lib/prototype/implementationIntegrationErrors";
import { shouldSuppressIntegrationContinueUserMessage } from "@/lib/prototype/implementationPreviewButtonPolicy";
import {
  isLegacyContinuePreviewMessage,
  resolveIntegrationPipelineUserToast,
} from "@/lib/prototype/implementationIntegrationToastPolicy";
import { INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE } from "@/lib/prototype/integrationPreviewPreflightService";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildInitialReviewStageUserTestSession,
  isReviewStageEntryReady,
  markReviewStageReturnedToImplementation,
  markReviewStageUserTestCompleted,
  markReviewStageUserTestStarted,
} from "@/lib/prototype/reviewStageUserTest";
import {
  canCompleteReviewStage,
  buildReviewFeedbackConvertNotice,
  convertReviewFeedbackToImplementationRework,
  getActiveReviewFeedbackItems,
} from "@/lib/prototype/reviewStageUserFeedback";
import {
  buildReviewStageEntryMessage,
  buildReviewStageViewFeedbackMessage,
  REVIEW_STAGE_ADD_FEEDBACK_GUIDE,
} from "@/lib/prototype/reviewStageMessage";
import {
  buildImplementationExecutionBoardMessage,
  buildImplementationBoardRefreshSyncKey,
  tryAppendImplementationUserConfirmationBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import { collapseImplementationBoardChatMessagesForPanelView, dedupeImplementationStageNextActions, extractBoardVisibleActionLabels, filterBoardDuplicateChatInterviewSuggestions } from "@/lib/prototype/implementationExecutionBoardPanelView";
import {
  appendReworkRequest,
  markReworkRequestsAcceptedForTask,
  resolveAllPendingUserConfirmations,
  updateBoardSelectedCodeTaskIds,
  updateBoardSelectedTaskIds,
} from "@/lib/prototype/implementationExecutionBoardState";
import {
  normalizeSelectedCodeTaskIds,
  prepareSelectedCodeTaskIdsForQuickRun,
  QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { evaluateQuickRunExecutionSelectionGate } from "@/lib/prototype/implementationExecutionButtonPolicy";
import { loadImplementationExecutionUnitsFromState } from "@/lib/prototype/implementationExecutionUnitStore";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { tryHandleImplementationTaskListChip } from "@/lib/prototype/implementationTaskListEntryMessage";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksFailedForWip,
  syncDeveloperTaskExecutionFromCodeAgentWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import { hasTaskListForWipOrchestration, shouldUseTaskListBoardWipGate } from "@/lib/prototype/implementationTaskListBoardWipGate";
import {
  finalizeIntegratedStageStep,
  markIntegratedStepInProgress,
  type ImplementationIntegratedStep,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import {
  buildCursorWorkItemsFromImplementationTaskListFallback,
  mergeCursorWorkItemsByTask,
  validateTaskScopedWorkItems,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationExecutionBlockedByPlanningGateTimelineEntry,
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationPlanningReadiness";
import { refineCursorWorkItemsForImplementation } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  buildWorkItemPreflightTimelineEntry,
  formatWorkItemPreflightBlockedMessage,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import { buildPrototypeRunExecutionSyncPatch, deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import {
  appendPromptTimelineEntries,
  buildImplementationWipGenerationTimelineEntry,
  buildTaskListDerivedWipOrchestration,
  canUseTaskListForWipOrchestration,
  mergeTaskListWipRuntimeState,
  prepareWipRequestRuntime,
} from "@/lib/prototype/implementationTaskListWipPrep";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import {
  buildImplementationStatusToastDedupeKey,
  shouldSuppressImplementationStatusMessage,
} from "@/lib/prototype/implementationStatusChatPolicy";
import {
  formatDeveloperPromptHeaderCopySuccessToast,
  formatDeveloperPromptSingleCopySuccessToast,
  resolveDeveloperPromptCopyFromSelection,
} from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import {
  resolveCodeTaskDeveloperPromptForCopy,
} from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { getCodeTaskPromptContextFromMap } from "@/lib/prototype/codeTaskPromptContext";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import {
  buildTaskCursorExecutionRequest,
  buildTaskCursorFailedOrchestrationPatch,
  buildTaskCursorOrchestrationPatch,
  shouldSyncExecutionStateAfterTaskCursorGithubVerify,
  syncTaskExecutionStateAfterGithubVerified,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { isTaskCursorExecutePromptPreflightFailure } from "@/lib/prototype/taskCursorExecutePreflightResponse";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  buildImplementationAutoQualityGateTriggerKey,
  isImplementationAutoQualityGateClientInFlight,
  resolveCodeTaskRunForAutoQualityGateClient,
  runImplementationAutoQualityGateClient,
  shouldTriggerImplementationAutoQualityGateClient,
} from "@/lib/prototype/implementationAutoQualityGateClient";
import {
  buildImplementationExecutionLogTimelineEntry,
  buildPromptTimelineOrchestrationPatch,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import { appendImplementationUiToastToPromptTimeline } from "@/lib/prototype/implementationUiToastExecutionLog";
import { mergeImplementationExecutionLogTimeline } from "@/lib/prototype/implementationOrchestrationExecutionLog";
import { pickPersistentExecutionLogTimelineEntries } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { buildCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findActiveCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  getCurrentCodeTaskRunForQueue,
  parseCodeTaskExecutionRunsV1,
  updateCodeTaskExecutionRun,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import {
  getCurrentQueueCodeTaskId,
  parseCodeTaskExecutionQueueV1,
  resolveSelectedCodeTaskIdsForQueue,
} from "@/lib/prototype/codeTaskExecutionQueue";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  prepareSelectedCodeTaskCursorExecution,
  type CodeTaskQueueDispatchRef,
} from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { mergeRequirementsStateWithRuntime } from "@/lib/prototype/implementationRuntimeSync";
import {
  buildPersistedActiveDispatchSnapshotPatch,
  resolvePersistedQueueDispatch,
} from "@/lib/prototype/implementationRuntimePanelBridge";
import { resolveImplementationRuntimeStateForRead } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
import { readActiveRuntimeDispatchFromState } from "@/lib/prototype/implementationRuntimeSync";
import {
  fetchImplementationRuntime,
  postImplementationRuntimeAction,
  type ImplementationRuntimeDiagnosticsRow,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import { postPlanningResetCascade } from "@/lib/requirements/planningResetCascadeClient";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { shouldPollImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiFlow";
import {
  parseImplementationRuntimeStateV1,
  patchRuntimeWatchdogPoll,
} from "@/lib/prototype/implementationRuntimeState";
import {
  buildCodeTaskRunLaunchToastMessage,
  buildCodeTaskRunUserStatus,
  CODE_TASK_IN_FLIGHT_USER_MESSAGE,
} from "@/lib/prototype/codeTaskExecutionRunView";
import {
  buildImplementationQuickRunStartedPatch,
  buildImplementationQuickRunCursorDispatchTimelineEntry,
  buildImplementationQuickRunTimelineEntry,
  formatQuickRunContinuationReason,
  parseImplementationQuickRunV1,
  resolveQuickRunAllowedTaskIds,
} from "@/lib/prototype/implementationQuickRun";
import { shouldPlanQuickRunCodeTaskContinuationAfterAutoGate } from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import { runQuickRunStuckGithubVerifyRecovery } from "@/lib/prototype/implementationQuickRunGithubVerifyRecovery";
import {
  applyTaskCursorGithubVerifyApiResult,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
  resolveTaskCursorGithubVerifyUserNotice,
} from "@/lib/prototype/taskCursorGithubVerifyClient";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { normalizeSelectedTaskIds } from "@/lib/prototype/implementationTaskTreeSelection";
import { RequirementsPromptDocumentDrawer } from "@/components/requirements/RequirementsPromptDocumentDrawer";
import type { PromptTimelineDrawerTab } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  buildTaskCursorLaunchTransientFailurePatch,
  formatTransientTaskCursorLaunchErrorMessage,
  isTransientTaskCursorLaunchError,
  postTaskCursorExecuteWithRetry,
} from "@/lib/prototype/taskCursorLaunchRetry";
import {
  formatTaskCursorElapsedMinutes,
  isActiveTaskCursorExecution,
  isInFlightTaskCursorExecution,
} from "@/lib/prototype/taskCursorClientPollLoop";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { buildTaskCursorJobOrchestrationSyncFingerprint } from "@/lib/prototype/taskCursorJobStateSync";
import { shouldSyncTaskCursorServerJobPollState } from "@/lib/prototype/taskCursorServerJobPollState";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { parseTaskCursorExecutionV1, patchTaskCursorExecution, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { PrototypeExecutionOperationalSendResult } from "@/components/preview/usePrototypeExecutionSingleChat";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { usePrototypeExecutionSingleChat } from "@/components/preview/usePrototypeExecutionSingleChat";
import { buildDisplayedPlannerUserMessage, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import {
  isPrototypeTemplatePlanningReady,
  shouldLockInlineChatTemplateSelection,
} from "@/lib/prototype/prototypeRunUiHelpers";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import { PrototypeTemplateChangeModal } from "@/components/preview/PrototypeTemplateChangeModal";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import {
  isPrototypeExecutionEnvOk,
  loadPrototypeExecutionEnvStatus,
} from "@/lib/prototype/prototypeExecutionEnvOk";
import { buildCursorPrototypePromptPackage } from "@/lib/prototype/buildCursorPrototypePrompt";
import {
  buildPrototypeKnowledgePackQueryBlob,
  fetchPrototypePreviewKnowledgePackInnerMarkdown,
} from "@/lib/knowledge-packs/knowledgePackPrototypePreviewContext";
import { analyzePrototypeContext } from "@/lib/prototype/prototypeContextAnalyzer";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import {
  defaultPrototypeGenerationRecord,
  loadPrototypeGenerationRecord,
  savePrototypeGenerationRecord,
  type PrototypeGenerationLocalRecord,
} from "@/lib/prototype/prototypeGenerationLocalStore";
import {
  fetchLatestPrototypeRun,
  postCreatePrototypeRun,
  postPrototypeConfirmExecution,
  postPrototypeRegeneratePlan,
  postPrototypeRetryWorkUnit,
  postPrototypeRunRefresh,
} from "@/lib/prototype/prototypeRunApiClient";
import { workUnitProgressFromRun } from "@/lib/prototype/prototypePlannerService";
import type { PrototypeRun, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";
import { buildPrototypePlannerInstructionBlock } from "@/lib/prototype/prototypePlannerLlm";
import { computePrototypeExecutionSlots } from "@/lib/prototype/prototypeExecutionSlots";
import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { isNextPublicDevWorkflowToolsEnabled } from "@/lib/env/devWorkflowTools";
import { PrototypeTemplateMockPreview } from "@/components/preview/PrototypeTemplateMockPreview";
import { ProjectExecutionEnvironmentModal } from "@/components/project/ProjectExecutionEnvironmentModal";
import type { Project } from "@/components/project-spec/types";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type PrototypeWorkspaceTimelineCardV1,
  type RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import { buildImplementationConversationResetStateJson } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { SpecWorkspaceProjectPatchResponseBody } from "@/lib/types/specWorkspaceProjectPatch";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { resolveEnabledCatalogKeysForScreen } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { WorkspaceConversationHubIconRow } from "@/components/workspace/WorkspaceConversationHubIconRow";
import {
  buildConversationMarkdown,
  confirmResetConversation,
  downloadConversationMarkdownFile,
} from "@/lib/chat/conversationMarkdown";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { postWorkNoteSummarize } from "@/lib/worknote/workNotesSummarizeApi";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";

type EnvBadge = "ok" | "needs" | "error" | "loading";
type EnvStatus = Readonly<{
  git: EnvBadge;
  github: EnvBadge;
  cursor: EnvBadge;
  connectionTest: EnvBadge;
  runnable: EnvBadge;
  message: string | null;
}>;

function githubPagesSettingsUrlFromSuggestedPreview(suggested: string | null | undefined): string | null {
  const s = String(suggested ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const m = /^([^.]+)\.github\.io$/i.exec(host);
    if (!m) return null;
    const owner = m[1];
    const pathSeg = u.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)[0];
    if (!pathSeg) return `https://github.com/${owner}/${owner}/settings/pages`;
    return `https://github.com/${owner}/${pathSeg}/settings/pages`;
  } catch {
    return null;
  }
}

function isLikelyPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

export function PrototypePreviewPanel({
  projectId,
  projectName,
  projectDescription,
  requirementsStateJson,
  ideationAssets,
  flowSteps,
  actors,
  featureDraftTitles,
  checklistGapLabels,
  designFingerprint,
  autoRefineImplementationPrep,
  onRequirementsStateJsonChange,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
  readonly ideationAssets: ReadonlyArray<PrototypeWorkspaceIdeationAsset>;
  readonly flowSteps: ReadonlyArray<PrototypePreviewFlowStep>;
  readonly actors: ReadonlyArray<PrototypePreviewActor>;
  readonly featureDraftTitles?: readonly string[];
  readonly checklistGapLabels: readonly string[];
  readonly designFingerprint: string;
  readonly autoRefineImplementationPrep?: boolean;
}) {
  // Avoid hydration mismatch: do not read sessionStorage in initial render.
  const [record, setRecord] = useState<PrototypeGenerationLocalRecord>(() => defaultPrototypeGenerationRecord());
  const [toast, setToast] = useState<string | null>(null);
  const toastClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [templateChangeOpen, setTemplateChangeOpen] = useState(false);
  const [plannerPromptModalOpen, setPlannerPromptModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [templateOverride, setTemplateOverride] = useState<PrototypeTemplateType | null>(null);
  const [envStatus, setEnvStatus] = useState<EnvStatus>({
    git: "needs",
    github: "needs",
    cursor: "needs",
    connectionTest: "needs",
    runnable: "needs",
    message: null,
  });
  const [envCheckInFlight, setEnvCheckInFlight] = useState(false);
  const [latestRun, setLatestRun] = useState<PrototypeRun | null>(null);
  const [automationAvailable, setAutomationAvailable] = useState(false);
  const [automationBlockReason, setAutomationBlockReason] = useState<PrototypeRunStatusReason>(null);
  const [protoBusy, setProtoBusy] = useState(false);
  const [integrationPipelineBusy, setIntegrationPipelineBusy] = useState(false);
  const [integrationPipelineClientResult, setIntegrationPipelineClientResult] = useState<{
    readonly status?: string;
    readonly previewReady?: boolean;
    readonly receivedAt?: number;
  } | null>(null);
  const integrationPipelineClientResultRef = useRef(integrationPipelineClientResult);
  integrationPipelineClientResultRef.current = integrationPipelineClientResult;
  const [integrationMergeBusy, setIntegrationMergeBusy] = useState(false);
  const [implementationStageNoticeModal, setImplementationStageNoticeModal] = useState<{
    readonly body: string;
    readonly actionLabels?: readonly string[];
  } | null>(null);
  const [implementationResetBusy, setImplementationResetBusy] = useState(false);
  const [implementationConversationResetNonce, setImplementationConversationResetNonce] = useState(0);
  /** postCreate 호출 직후~응답 전: 입력 잠금·진행 UI용 */
  const [plannerCreatePending, setPlannerCreatePending] = useState(false);
  const [pendingImplementationPatch, setPendingImplementationPatch] =
    useState<PendingImplementationPatch>({});
  const pendingImplementationPatchRef = useRef(pendingImplementationPatch);
  pendingImplementationPatchRef.current = pendingImplementationPatch;
  const [executionSetupRow, setExecutionSetupRow] =
    useState<ExecutionSetupSourceGenerationRow | null>(null);
  const [canApplyGit, setCanApplyGit] = useState<boolean | undefined>(undefined);
  const executionSetupBoardSyncedKeyRef = useRef<string | null>(null);
  const refreshImplementationBoardRef = useRef<
    ((setup: ExecutionSetupSourceGenerationRow | null, source?: string) => void) | null
  >(null);
  const [plannerProgressStep, setPlannerProgressStep] = useState(1);
  const planProgressStartedAtRef = useRef(0);
  /** 작업계획 생성 중복 클릭 방지 — state와 달리 동기적으로 잠금 */
  const planRequestInFlightRef = useRef(false);
  // --- chat-led UX (transient, state-derived) ---
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  /** DB에 저장하는 타임라인 카드(작업계획·WorkUnit 완료), 재실행 후에도 유지 */
  const [timelineCards, setTimelineCards] = useState<readonly PrototypeWorkspaceTimelineCardV1[]>([]);
  const lastTimelineSnapRef = useRef<string>("");
  /** 작업계획 API 호출 전: 생성 버튼 → 프롬프트/작업 시작 대기 */
  const [prePlanGate, setPrePlanGate] = useState<PrototypePrePlanGate>("idle");
  const prePlannerNotesRef = useRef("");
  const appendExecutionNoticeRef = useRef<(text: string) => void>(() => {});
  /** [확정]까지 눌러야 true — 콤보만으로는 true가 되지 않음 */
  const [templateConfirmed, setTemplateConfirmed] = useState(false);
  /** 콤보에서의 선택(미확정 포함). AI 추천 행은 `PROTOTYPE_INLINE_TEMPLATE_AI_VALUE` */
  const [draftPickerValue, setDraftPickerValue] = useState<string>(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
  const [protoMembersModalOpen, setProtoMembersModalOpen] = useState(false);
  const [executionEnvironmentModalOpen, setExecutionEnvironmentModalOpen] = useState(false);
  const [implementationPromptDrawerOpen, setImplementationPromptDrawerOpen] = useState(false);
  const [implementationPromptDrawerTab, setImplementationPromptDrawerTab] =
    useState<PromptTimelineDrawerTab>("execution_log");
  const [artifactHubOpen, setArtifactHubOpen] = useState(false);
  const [executionAiSummaryBusy, setExecutionAiSummaryBusy] = useState(false);
  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [deliverableViewerIds, setDeliverableViewerIds] = useState<readonly string[]>([]);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);
  const [viewerDerivedAssets, setViewerDerivedAssets] = useState<
    readonly import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset[]
  >([]);
  const [workspaceAiGraph, setWorkspaceAiGraph] = useState<WorkspaceAiGraphMemberWire[] | null>(null);
  /** 추천·병합 지식팩 컨텍스트(프로토타입 프롬프트 미리보기용, 실패 시 비움) */
  const [knowledgePackContextText, setKnowledgePackContextText] = useState<string | undefined>(undefined);
  const prototypeAiTitle = displayedWorkspaceAiTitle("prototype_build");
  const prototypeComposerAtAtItems = useMemo((): readonly ComposerAtAtPickerItem[] => {
    return [
      { id: "prototype:picker:ai", label: prototypeAiTitle, targets: [{ id: VIRTUAL_AI_PLANNER_ID, name: prototypeAiTitle }] },
      { id: "prototype:picker:user", label: "사용자", targets: [{ id: "prototype:mention:user", name: "사용자" }] },
    ];
  }, [prototypeAiTitle]);

  const refreshRecord = useCallback(() => {
    setRecord(loadPrototypeGenerationRecord(projectId));
  }, [projectId]);

  useEffect(() => {
    // Load browser sessionStorage after mount (prevents SSR/client divergence).
    refreshRecord();
  }, [refreshRecord]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) {
      setWorkspaceAiGraph(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await credentialsIncludeFetch(`/api/project/workspace-ai?projectId=${encodeURIComponent(pid)}`);
        const json = (await res.json()) as { success?: boolean; data?: { members?: WorkspaceAiGraphMemberWire[] } };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data?.members) {
          setWorkspaceAiGraph(null);
          return;
        }
        setWorkspaceAiGraph(json.data.members);
      } catch {
        if (!cancelled) setWorkspaceAiGraph(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) {
      setCanApplyGit(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await credentialsIncludeFetch(
          `/api/project/session-context?projectId=${encodeURIComponent(pid)}`,
        );
        const json = (await res.json()) as {
          success?: boolean;
          data?: { permissions?: { canApplyGit?: boolean } };
        };
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setCanApplyGit(undefined);
          return;
        }
        setCanApplyGit(json.data?.permissions?.canApplyGit === true);
      } catch {
        if (!cancelled) setCanApplyGit(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") queueMicrotask(() => refreshRecord());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshRecord]);

  const refreshLatestRun = useCallback(async () => {
    if (!projectId.trim()) return;
    const r = await fetchLatestPrototypeRun(projectId);
    if (r.success && r.data) {
      setLatestRun(r.data.run);
      setAutomationAvailable(r.data.automationAvailable);
      setAutomationBlockReason(r.data.automationBlockReason);
    }
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshLatestRun(), 0);
    return () => window.clearTimeout(t);
  }, [refreshLatestRun]);

  const analysis = useMemo(
    () =>
      analyzePrototypeContext({
        projectName,
        projectDescription,
        ideationAssets,
        flowSteps,
        actors,
        checklistMissingLabels: checklistGapLabels,
      }),
    [projectName, projectDescription, ideationAssets, flowSteps, actors, checklistGapLabels],
  );

  useEffect(() => {
    const r = loadPrototypeGenerationRecord(projectId);
    const raw = r.selectedTemplate;
    const normalized = raw && PROTOTYPE_TEMPLATES.some((t) => t.id === raw) ? (raw as PrototypeTemplateType) : null;
    if (normalized) {
      setTemplateOverride(normalized);
      setDraftPickerValue(normalized);
    } else {
      setTemplateOverride(null);
      setDraftPickerValue(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
    }
    setTemplateConfirmed(r.templateCommittedToPlan === true);
    /**
     * 채팅 로그 우선순위:
     * 1) DB(Project.requirementsStateJson) 영구 저장
     * 2) 로컬(sessionStorage) — DB 미연동/오프라인 대비
     */
    const db = parseRequirementsStateJson(requirementsStateJson);
    const tc = db.prototypeWorkspaceTimelineCardsV1;
    setTimelineCards(Array.isArray(tc) && tc.length ? [...tc] : []);
    lastTimelineSnapRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on project switch
  }, [projectId]);

  const reloadExecutionSetupRow = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) {
      setExecutionSetupRow(null);
      return null;
    }
    const res = await fetchExecutionSetup(pid);
    const data = res.res.ok && res.json.success ? res.json.data : null;
    const row = mapExecutionSetupDtoToSourceGenerationRow(data);
    setExecutionSetupRow(row);
    return row;
  }, [projectId]);

  useEffect(() => {
    void reloadExecutionSetupRow();
    executionSetupBoardSyncedKeyRef.current = null;
  }, [reloadExecutionSetupRow]);

  const lastPersistedChatFingerprintRef = useRef<string>("");
  const orchestrationPersistSeqRef = useRef(0);
  const implementationResetInFlightRef = useRef(false);
  const applyPendingFromOrchestrationPatchRef = useRef<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >(() => {});
  const persistChatToDb = useCallback(
    async (
      chatPatch?: {
        messages: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
        slots: readonly import("@/lib/prototype/prototypeExecutionSingleChatTypes").PrototypeExecutionInterviewSlot[];
        answers: Readonly<Record<string, string>>;
        currentSlotKey: string | null;
      },
      orchestrationPatch?: Omit<PrototypeExecutionOrchestrationPersistInput, "chat">,
      persistSeq?: number,
      persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
    ): Promise<{ readonly serverSaved: boolean } | void> => {
      const mySeq = persistSeq ?? ++orchestrationPersistSeqRef.current;
      const pid = projectId.trim();
      if (!pid) return { serverSaved: false };
      const tc = [...timelineCards].slice(-300);
      const fingerprint = JSON.stringify({
        c: chatPatch?.messages?.map((m) => [m.id, m.createdAt]) ?? [],
        t: tc.map((c) => [c.id, c.at]),
        o: orchestrationPatch
          ? [
              orchestrationPatch.implementationTaskPlanV1?.createdAt,
              orchestrationPatch.cursorWorkItemsV1?.length,
              orchestrationPatch.codeAgentWipExecutionV1?.status,
              orchestrationPatch.codeAgentWipExecutionV1?.requestedAt,
              orchestrationPatch.codeAgentWipExecutionV1?.selectedTaskId,
              orchestrationPatch.codeAgentWipExecutionV1?.bridgeExecutionStatus,
              orchestrationPatch.taskCursorExecutionV1?.status,
              orchestrationPatch.taskCursorExecutionV1?.cursorRunId,
              orchestrationPatch.taskCursorExecutionV1?.updatedAt,
              (() => {
                const logs = pickPersistentExecutionLogTimelineEntries(orchestrationPatch.promptTimeline);
                const last = logs.at(-1);
                return [
                  logs.length,
                  last ? buildPromptTimelineEntryFingerprint(last) : null,
                  last?.createdAt ?? null,
                ];
              })(),
              orchestrationPatch.implementationTaskExecutionStateV1?.updatedAt,
              orchestrationPatch.implementationTaskExecutionStateV1?.summary,
              orchestrationPatch.implementationStageActionRunLogV1 ? "runlog" : null,
              orchestrationPatch.implementationQuickRunV1?.status,
              orchestrationPatch.implementationQuickRunV1?.updatedAt,
              orchestrationPatch.codeTaskExecutionRunsV1?.length,
              orchestrationPatch.implementationPreviewRuntimeV1?.generatedAt,
              orchestrationPatch.implementationPreviewScopeV1?.generatedAt,
            ]
          : null,
      });
      if (!persistOptions?.force && fingerprint === lastPersistedChatFingerprintRef.current) {
        return { serverSaved: true };
      }
      lastPersistedChatFingerprintRef.current = fingerprint;

      const prior = parseRequirementsStateJson(requirementsStateJsonRef.current);
      const mergedWithoutAutoLog =
        chatPatch || orchestrationPatch
          ? buildPrototypeExecutionOrchestrationPersistPatch(requirementsStateJsonRef.current, {
              ...(chatPatch ? { chat: chatPatch } : {}),
              ...(orchestrationPatch ?? {}),
            })
          : mergeRequirementsStateJson(parseRequirementsStateJson(requirementsStateJsonRef.current), {
              prototypeWorkspaceTimelineCardsV1: tc,
              lastSavedAt: new Date().toISOString(),
            });

      const promptTimeline =
        orchestrationPatch !== undefined
          ? mergeImplementationExecutionLogTimeline({
              prior,
              next: mergedWithoutAutoLog,
              patch: orchestrationPatch,
            })
          : (mergedWithoutAutoLog.promptTimeline ?? prior.promptTimeline ?? []);

      const mergedBase =
        orchestrationPatch !== undefined && promptTimeline.length
          ? { ...mergedWithoutAutoLog, promptTimeline }
          : mergedWithoutAutoLog;

      const merged =
        chatPatch || orchestrationPatch
          ? (mergeRequirementsStateWithRuntime({
              projectId: pid,
              state: mergedBase as Record<string, unknown>,
            }) as typeof mergedBase)
          : mergedBase;

      if (mySeq !== orchestrationPersistSeqRef.current) return { serverSaved: false };

      requirementsStateJsonRef.current = merged;
      if (orchestrationPatch) {
        applyPendingFromOrchestrationPatchRef.current({
          ...orchestrationPatch,
          ...(merged.promptTimeline?.length ? { promptTimeline: merged.promptTimeline } : {}),
        });
      }

      queueMicrotask(() => {
        onRequirementsStateJsonChange?.(merged);
      });
      let serverSaved = true;
      if (persistOptions?.awaitServer) {
        const patchResult = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
        if (patchResult.networkError) {
          serverSaved = false;
          console.warn("[spec-workspace] PATCH network error — local state kept");
        }
      } else {
        void patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
      }
      return { serverSaved };
    },
    [projectId, timelineCards, onRequirementsStateJsonChange],
  );

  const appendUiToastToExecutionLog = useCallback(
    (message: string) => {
      const pid = projectId.trim();
      if (!pid || !String(message ?? "").trim()) return;
      const base = parseRequirementsStateJson(requirementsStateJsonRef.current);
      const prior = resolveOrchestrationAwareRequirementsState({
        base,
        pendingPatch: pendingImplementationPatchRef.current,
      }).promptTimeline;
      const promptTimeline = appendImplementationUiToastToPromptTimeline({
        priorTimeline: prior,
        projectId: pid,
        message,
      });
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline });
      void persistChatToDb(undefined, { promptTimeline }, undefined, { force: true });
    },
    [persistChatToDb, projectId],
  );

  const persistExecutionStateFromPrototypeRun = useCallback(
    (run: import("@/lib/prototype/prototypeRunTypes").PrototypeRun | null | undefined) => {
      if (!run) return;
      const parsed = parseRequirementsStateJson(requirementsStateJson);
      const sync = buildPrototypeRunExecutionSyncPatch({
        currentState: parsed.implementationTaskExecutionStateV1,
        latestRun: run,
        workUnits: run.workUnits,
      });
      if (!sync.changed || !sync.nextState) return;
      void persistChatToDb(undefined, { implementationTaskExecutionStateV1: sync.nextState });
    },
    [requirementsStateJson, persistChatToDb],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void persistChatToDb(), 1200);
    return () => window.clearTimeout(t);
  }, [persistChatToDb]);

  const effectiveTemplate = useMemo((): PrototypeTemplateType => {
    if (templateConfirmed) return templateOverride ?? analysis.recommendedTemplate;
    if (draftPickerValue === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE) return analysis.recommendedTemplate;
    return draftPickerValue as PrototypeTemplateType;
  }, [templateConfirmed, templateOverride, draftPickerValue, analysis.recommendedTemplate]);
  const effectiveTemplateDef = useMemo(
    () => PROTOTYPE_TEMPLATES.find((t) => t.id === effectiveTemplate) ?? null,
    [effectiveTemplate],
  );
  const effectiveAnalysis = useMemo(
    () => ({ ...analysis, recommendedTemplate: effectiveTemplate }),
    [analysis, effectiveTemplate],
  );

  const actorName = useCallback(
    (id: string) => actors.find((a) => a.id === id)?.name ?? id,
    [actors],
  );

  const plannerContextPayload = useMemo(
    () => ({
      projectDescription: projectDescription.trim(),
      actorFlowSummary: flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n"),
      featureDraftTitles: featureDraftTitles ?? [],
      ideationSummary: ideationAssets
        .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12_000),
    }),
    [projectDescription, flowSteps, featureDraftTitles, ideationAssets],
  );

  const knowledgePackQueryBlob = useMemo(
    () =>
      buildPrototypeKnowledgePackQueryBlob({
        projectName,
        projectDescription,
        ideationAssets,
        flowSteps,
        featureDraftTitles,
      }),
    [projectName, projectDescription, ideationAssets, flowSteps, featureDraftTitles],
  );

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || knowledgePackQueryBlob.trim().length < 12) {
      setKnowledgePackContextText(undefined);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const inner = await fetchPrototypePreviewKnowledgePackInnerMarkdown(credentialsIncludeFetch, {
            projectId: pid,
            queryBlob: knowledgePackQueryBlob,
          });
          setKnowledgePackContextText(inner);
        } catch {
          setKnowledgePackContextText(undefined);
        }
      })();
    }, 800);
    return () => window.clearTimeout(t);
  }, [projectId, knowledgePackQueryBlob]);

  const promptPackage = useMemo(() => {
    const stepsForPrompt = flowSteps.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      primaryActorId: s.primaryActorId,
      ownerName: actorName(s.primaryActorId),
    }));
    return buildCursorPrototypePromptPackage({
      analysis: effectiveAnalysis,
      projectName: projectName.trim() || "프로젝트",
      projectDescription: projectDescription.trim(),
      actors: actors.map((a) => ({ name: a.name, kind: a.kind, description: a.description })),
      flowSteps: stepsForPrompt,
      featureDraftTitles,
      knowledgePackContextText,
    });
  }, [
    effectiveAnalysis,
    projectName,
    projectDescription,
    actors,
    flowSteps,
    featureDraftTitles,
    actorName,
    knowledgePackContextText,
  ]);

  const ownersOk = flowSteps.length > 0 && flowSteps.every((s) => String(s.primaryActorId ?? "").trim());
  const ideaOk = projectDescription.trim().length > 24 || ideationAssets.some((a) => String(a.content ?? a.title ?? "").trim().length > 20);
  const actorsOk = actors.length >= 1;
  const flowOk = flowSteps.length >= 3;

  const ownerAssignedRatio = useMemo(() => {
    if (!flowSteps.length) return 0;
    const n = flowSteps.filter((s) => String(s.primaryActorId ?? "").trim()).length;
    return Math.round((n / flowSteps.length) * 100);
  }, [flowSteps]);

  const canRequestGeneration = useMemo(() => {
    const designOk = ideaOk && actorsOk && flowOk && ownerAssignedRatio >= 60;
    const envOk = isPrototypeExecutionEnvOk(envStatus);
    return { designOk, envOk, ok: designOk && envOk };
  }, [
    ideaOk,
    actorsOk,
    flowOk,
    ownerAssignedRatio,
    envStatus.runnable,
    envStatus.git,
    envStatus.github,
    envStatus.cursor,
    envStatus.connectionTest,
  ]);

  const templatePlanningReady = useMemo(
    () =>
      isPrototypeTemplatePlanningReady({
        templateConfirmed,
        envOk: canRequestGeneration.envOk,
        draftPickerValue,
      }),
    [templateConfirmed, canRequestGeneration.envOk, draftPickerValue],
  );

  const executionSlots = useMemo(() => computePrototypeExecutionSlots(latestRun), [latestRun]);

  const sortedWorkUnitsForSidebar = useMemo(
    () => [...(latestRun?.workUnits ?? [])].sort((a, b) => a.order - b.order),
    [latestRun?.workUnits],
  );

  const previewUrl = useMemo(() => {
    const fromServer =
      latestRun?.previewUrl && isLikelyPreviewUrl(latestRun.previewUrl) ? latestRun.previewUrl.trim() : null;
    if (fromServer) return fromServer;
    return record.previewUrl && isLikelyPreviewUrl(record.previewUrl) ? record.previewUrl.trim() : null;
  }, [latestRun?.previewUrl, record.previewUrl]);

  const showToast = useCallback(
    (msg: string, displayMs = 3200) => {
      if (toastClearTimerRef.current) clearTimeout(toastClearTimerRef.current);
      const text = String(msg ?? "").trim() || String(msg ?? "");
      if (text) appendUiToastToExecutionLog(text);
      setToast(text);
      toastClearTimerRef.current = setTimeout(() => {
        setToast(null);
        toastClearTimerRef.current = null;
      }, displayMs);
    },
    [appendUiToastToExecutionLog],
  );

  const prototypeScreenCatalogIds = useMemo(() => {
    if (!workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, "prototype_build");
  }, [workspaceAiGraph]);


  useEffect(
    () => () => {
      if (toastClearTimerRef.current) clearTimeout(toastClearTimerRef.current);
    },
    [],
  );

  async function postPrototypeRunCancel(runId: string, input: { projectId: string; reason?: string }) {
    const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { success: boolean; data?: { run: PrototypeRun }; message?: string };
  }

  async function postPrototypeRunResume(runId: string, input: { projectId: string; mode: "resume" | "restart" }) {
    const res = await fetch(`/api/prototype-runs/${encodeURIComponent(runId)}/resume`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { success: boolean; data?: { run: PrototypeRun }; message?: string };
  }

  const onCursorAutoRequest = async () => {
    if (!canRequestGeneration.designOk || !automationAvailable) return;
    if ((latestRun?.workUnits?.length ?? 0) === 0) return;
    setProtoBusy(true);
    try {
      const res = await postCreatePrototypeRun({
        projectId,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        startCursorAgent: true,
        plannerContext: plannerContextPayload,
      });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        persistExecutionStateFromPrototypeRun(res.data.run);
        setAutomationAvailable(res.data.automationAvailable);
        setAutomationBlockReason(res.data.automationBlockReason);
        showToast(res.data.message ?? "Cursor 자동 생성을 요청했습니다.");
        savePrototypeGenerationRecord(projectId, {
          runStatus: "awaiting_preview",
          fingerprintAtRequest: designFingerprint,
          lastRequestedAt: new Date().toISOString(),
          lastError: null,
          selectedTemplate: effectiveTemplate,
          lastPromptSnapshot: promptPackage.slice(0, 30_000),
        });
        refreshRecord();
      } else {
        showToast(res.message ?? "자동 생성 요청에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  const runPlannerCreate = useCallback(
    async (prePlanUserNote?: string) => {
      if (!canRequestGeneration.designOk) return;
      if (!projectId.trim()) {
        appendExecutionNoticeRef.current("프로젝트 정보가 없어 작업계획 요청을 보낼 수 없습니다.");
        return;
      }
      const note = String(prePlanUserNote ?? "").trim();
      const plannerCtx =
        note.length > 0
          ? {
              ...plannerContextPayload,
              ideationSummary: `${plannerContextPayload.ideationSummary}\n\n[사용자 사전 지시]\n${note}`,
            }
          : plannerContextPayload;
      setProtoBusy(true);
      try {
        const res = await postCreatePrototypeRun({
          projectId,
          selectedTemplate: effectiveTemplate,
          promptSnapshot: promptPackage.slice(0, 50_000),
          startCursorAgent: false,
          plannerContext: plannerCtx,
        });
        if (res.success && res.data?.run) {
          /** 응답 직후 진행 말풍선이 잠깐 보일 때 단계를 모두 완료로 스냅 */
          setPlannerProgressStep(5);
          setLatestRun(res.data.run);
          persistExecutionStateFromPrototypeRun(res.data.run);
          setAutomationAvailable(res.data.automationAvailable);
          setAutomationBlockReason(res.data.automationBlockReason);
          const wuN = res.data.run.workUnits?.length ?? 0;
          const serverMsg = res.data.message?.trim();
          /**
           * “현재 실행이 진행 중입니다.”는 사용자가 이미 눌렀다는 의미뿐이라 UX에 도움되지 않음.
           * 대신 즉시 refresh를 호출해, 타임라인/플래너 진행 카드를 최신 상태로 갱신한다.
           */
          if (serverMsg === "현재 실행이 진행 중입니다.") {
            const rr = await postPrototypeRunRefresh(res.data.run.id, { projectId });
            if (rr.success && rr.data?.run) {
              setLatestRun(rr.data.run);
              persistExecutionStateFromPrototypeRun(rr.data.run);
            }
            return;
          }
          /** 서버가 메시지 없이 같은 run만 돌려준 경우(플래너 진행 중 중복 요청 등)는 타임라인 카드만 유지 */
          if (wuN === 0 && serverMsg) appendExecutionNoticeRef.current(serverMsg);
        } else {
          appendExecutionNoticeRef.current(res.message?.trim() || "작업계획 생성에 실패했습니다.");
        }
      } catch {
        appendExecutionNoticeRef.current("네트워크 오류로 작업계획 요청에 실패했습니다.");
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    },
    [canRequestGeneration.designOk, projectId, effectiveTemplate, promptPackage, plannerContextPayload, refreshLatestRun, persistExecutionStateFromPrototypeRun],
  );

  /**
   * 동기 진입점: `async`로 두면 클릭 직후 첫 줄이 한 박자 늦게 실행되어 연타 시 API가 여러 번 나갈 수 있음.
   * ref·flushSync·pending은 이 함수 본문이 끝나기 전에 모두 반영됨.
   */
  const startWorkPlanGenerationFromChat = useCallback(() => {
    if (planRequestInFlightRef.current) return;
    if (protoBusy) return;
    if (!canRequestGeneration.envOk) {
      appendExecutionNoticeRef.current("먼저 환경 검증과 연결 테스트를 완료해 주세요.");
      return;
    }
    if (!templatePlanningReady) {
      appendExecutionNoticeRef.current(
        "선택한 템플릿을 적용하려면 [확정]을 눌러 주세요. AI 추천 템플릿을 사용할 경우 별도 확정 없이 진행할 수 있습니다.",
      );
      return;
    }
    if (!canRequestGeneration.designOk) {
      appendExecutionNoticeRef.current("기획 산출물·설계 readiness가 완료된 뒤 작업계획을 생성할 수 있습니다.");
      return;
    }
    planRequestInFlightRef.current = true;
    const extra = prePlannerNotesRef.current.trim();
    prePlannerNotesRef.current = "";
    planProgressStartedAtRef.current = Date.now();
    flushSync(() => {
      setPlannerProgressStep(1);
      setPlannerCreatePending(true);
    });
    void (async () => {
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        await runPlannerCreate(extra || undefined);
      } finally {
        planRequestInFlightRef.current = false;
        setPlannerCreatePending(false);
      }
    })();
  }, [protoBusy, templatePlanningReady, canRequestGeneration.designOk, canRequestGeneration.envOk, runPlannerCreate]);

  const applyToolbarTemplateSelection = useCallback(
    (next: string) => {
      if (protoBusy) return;
      if (shouldLockInlineChatTemplateSelection(latestRun)) return;
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId =
        next === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE ? recommendedId : (next as PrototypeTemplateType);

      if (resolvedId === recommendedId) {
        setTemplateOverride(null);
        setDraftPickerValue(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
        setTemplateConfirmed(false);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: null, templateCommittedToPlan: false });
      } else {
        setTemplateOverride(resolvedId);
        setDraftPickerValue(resolvedId);
        setTemplateConfirmed(true);
        savePrototypeGenerationRecord(projectId, { selectedTemplate: resolvedId, templateCommittedToPlan: true });
        setPrePlanGate("need_create_click");
      }
      refreshRecord();
      setTemplateChangeOpen(false);
    },
    [analysis.recommendedTemplate, latestRun, projectId, protoBusy, refreshRecord],
  );

  const applyChatTemplateIntent = useCallback(
    (next: PrototypeTemplateType | null) => {
      const recommendedId = analysis.recommendedTemplate;
      const resolvedId = next ?? recommendedId;
      const nextDraft =
        resolvedId === recommendedId ? PROTOTYPE_INLINE_TEMPLATE_AI_VALUE : resolvedId;
      setDraftPickerValue(nextDraft);
      setTemplateConfirmed((c) => {
        if (c) savePrototypeGenerationRecord(projectId, { templateCommittedToPlan: false });
        return false;
      });
    },
    [analysis.recommendedTemplate, projectId],
  );

  useEffect(() => {
    if (!templatePlanningReady) {
      setPrePlanGate("idle");
      return;
    }
    /** 이미 실행이 시작된 상태라면(플래너 포함) “작업계획 생성” 버튼을 노출하지 않음 */
    if (latestRun?.id && latestRun.status !== "DRAFT" && latestRun.status !== "PROMPT_READY") {
      setPrePlanGate("idle");
      return;
    }
    const wu = (latestRun?.workUnits?.length ?? 0) > 0;
    if (latestRun?.id && wu) {
      setPrePlanGate("idle");
      return;
    }
    setPrePlanGate("need_create_click");
  }, [templatePlanningReady, latestRun?.id, latestRun?.status, latestRun?.workUnits?.length]);

  const onRefreshPrototypeStatus = async () => {
    if (!latestRun?.id) {
      await refreshLatestRun();
      showToast("최신 실행 정보를 불러왔습니다.");
      return;
    }
    setProtoBusy(true);
    try {
      const res = await postPrototypeRunRefresh(latestRun.id, { projectId });
      if (res.success && res.data?.run) {
        setLatestRun(res.data.run);
        persistExecutionStateFromPrototypeRun(res.data.run);
        showToast(res.data.userMessage?.trim() || "상태를 갱신했습니다.");
      } else {
        showToast(res.message ?? "갱신에 실패했습니다.");
      }
    } finally {
      setProtoBusy(false);
      void refreshLatestRun();
    }
  };

  /**
   * 자동 상태 폴링:
   * Prototype 파이프라인은 서버가 background worker로 run을 갱신하는 구조가 아니라,
   * `/refresh` 호출 시 Cursor agent poll → run store update 를 수행한다.
   * 따라서 실행 중에는 UI가 주기적으로 refresh를 호출해야 “멈춘 것처럼” 보이지 않는다.
   */
  const autoRefreshInFlightRef = useRef(false);
  useEffect(() => {
    const rid = latestRun?.id;
    const s = latestRun?.status;
    if (!rid || !s) return;
    if (protoBusy) return;
    const runningStatuses: readonly string[] = [
      // WORK_UNITS_READY is the "between units" state; if execution is confirmed,
      // we must keep polling so the next WorkUnit auto-starts without user clicking refresh.
      "PLANNER_ANALYZING",
      "CURSOR_REQUESTED",
      "CURSOR_RUNNING",
      "COMMIT_DETECTED",
      "PUSH_CONFIRMED",
      "AI_REVIEWING",
      "REWORK_REQUIRED",
      "PR_OPENED",
      "MERGED",
      "DEPLOY_CONFIGURING",
      "DEPLOYING",
    ];
    const shouldAutoRefreshWorkUnitsReady =
      s === "WORK_UNITS_READY" &&
      (latestRun?.workUnits?.length ?? 0) > 0 &&
      latestRun?.runSchemaVersion >= 2 &&
      latestRun?.workUnitsExecutionConfirmed === true;
    if (!runningStatuses.includes(s) && !shouldAutoRefreshWorkUnitsReady) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (autoRefreshInFlightRef.current) return;
      autoRefreshInFlightRef.current = true;
      void postPrototypeRunRefresh(rid, { projectId })
        .then((res) => {
          if (res.success && res.data?.run) {
            setLatestRun(res.data.run);
            persistExecutionStateFromPrototypeRun(res.data.run);
          }
        })
        .finally(() => {
          autoRefreshInFlightRef.current = false;
        });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnitsExecutionConfirmed,
    latestRun?.workUnits?.length,
    latestRun?.runSchemaVersion,
    projectId,
    protoBusy,
    persistExecutionStateFromPrototypeRun,
  ]);

  const loadEnv = useCallback(async () => {
    if (!projectId.trim()) return;
    const status = await loadPrototypeExecutionEnvStatus(projectId);
    setEnvStatus(status);
  }, [projectId]);

  const refreshExecutionEnvironmentStatus = useCallback(async () => {
    setEnvCheckInFlight(true);
    try {
      await loadEnv();
      return await reloadExecutionSetupRow();
    } finally {
      setEnvCheckInFlight(false);
    }
  }, [loadEnv, reloadExecutionSetupRow]);

  const canStartPrototypeAutomation = useMemo(
    () => automationAvailable && canRequestGeneration.designOk && canRequestGeneration.envOk,
    [automationAvailable, canRequestGeneration.designOk, canRequestGeneration.envOk],
  );

  const awaitingExecutionConfirm = useMemo(() => {
    const r = latestRun;
    if (!r) return false;
    return (
      r.status === "WORK_UNITS_READY" &&
      r.workUnits.length > 0 &&
      r.runSchemaVersion >= 2 &&
      r.workUnitsExecutionConfirmed !== true
    );
  }, [latestRun]);

  const isRunningState = useMemo(() => {
    const s = latestRun?.status;
    if (!s) return false;
    if (s === "BLOCKED") return false;
    const prog = latestRun ? workUnitProgressFromRun(latestRun) : null;
    const allWuMerged = latestRun ? workUnitProgressAllMerged(latestRun) : false;
    const mid =
      prog &&
      !prog.allMerged &&
      (s === "MERGED" || s === "PR_OPENED" || s === "DEPLOYING" || s === "CURSOR_REQUESTED" || s === "CURSOR_RUNNING");
    const wuReadyRunning =
      s === "WORK_UNITS_READY" &&
      !awaitingExecutionConfirm &&
      (latestRun.workUnits?.length ?? 0) > 0;
    const deployAfterUnits =
      allWuMerged && (s === "MERGED" || s === "DEPLOY_CONFIGURING" || s === "DEPLOYING");
    return (
      deployAfterUnits ||
      s === "DEPLOY_CONFIGURING" ||
      s === "DEPLOYING" ||
      s === "PLANNER_ANALYZING" ||
      wuReadyRunning ||
      s === "CURSOR_REQUESTED" ||
      s === "CURSOR_RUNNING" ||
      s === "COMMIT_DETECTED" ||
      s === "PUSH_CONFIRMED" ||
      s === "AI_REVIEWING" ||
      Boolean(mid)
    );
  }, [latestRun, awaitingExecutionConfirm]);

  /** `plannerStatus`만 RUNNING으로 남는 불일치 시에도 UI가 막히지 않도록 실행 단계(status)만 사용 */
  const isPlannerRunning = useMemo(() => latestRun?.status === "PLANNER_ANALYZING", [latestRun?.status]);

  useEffect(() => {
    const active = isPlannerRunning || plannerCreatePending;
    const hasUnits = (latestRun?.workUnits?.length ?? 0) > 0;
    if (!active || hasUnits) return;
    const tick = () => {
      const elapsed = Date.now() - planProgressStartedAtRef.current;
      const step = Math.min(5, 1 + Math.floor(elapsed / 2000));
      setPlannerProgressStep(step);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [isPlannerRunning, plannerCreatePending, latestRun?.workUnits?.length]);

  /** 전송·Enter: 플래너/파이프라인 작업 중에는 입력 비활성 (계획 확정 전 수정 요청만 허용) */
  const isMessageInputBlocked = useMemo(() => {
    if (plannerCreatePending) return true;
    if (protoBusy) return true;
    if (isPlannerRunning) return true;
    const r = latestRun;
    if (r?.status === "WORK_UNITS_READY" && r.workUnitsExecutionConfirmed !== true && (r.workUnits?.length ?? 0) > 0) {
      return false;
    }
    const s = r?.status;
    if (!s) return false;
    const blocked: readonly string[] = [
      "PLANNER_ANALYZING",
      "CURSOR_REQUESTED",
      "CURSOR_RUNNING",
      "COMMIT_DETECTED",
      "PUSH_CONFIRMED",
      "AI_REVIEWING",
      "PR_OPENED",
      "MERGED",
      "DEPLOY_CONFIGURING",
      "DEPLOYING",
    ];
    return blocked.includes(s);
  }, [plannerCreatePending, protoBusy, isPlannerRunning, latestRun]);

  const hasCompletedWorkPlan = useMemo(
    () => (latestRun?.workUnits?.length ?? 0) > 0,
    [latestRun?.workUnits],
  );

  const canStartFullPrototypePipeline = useMemo(
    () => canStartPrototypeAutomation && hasCompletedWorkPlan && !isPlannerRunning,
    [canStartPrototypeAutomation, hasCompletedWorkPlan, isPlannerRunning],
  );

  const isCancelled = latestRun?.status === "CANCELLED";
  const workPipelineFailed = latestRun?.status === "FAILED";
  const deployFailedOnly = latestRun?.status === "DEPLOY_FAILED";
  /** 초안 생성 완료(정식 배포 URL 확정 전). 배포 완료 후에는 타임라인 완료 카드 대신 일반 상태로 둠 */
  const isDraftGenerationComplete = useMemo(
    () => latestRun?.status === "PREVIEW_READY" && !String(latestRun?.publicUrl ?? "").trim(),
    [latestRun?.status, latestRun?.publicUrl],
  );
  const isCompleted = isDraftGenerationComplete;
  const deployPhase = useMemo(() => isPrototypeDeployPhase(latestRun), [latestRun]);

  const plannerUserMessagePreview = useMemo(
    () =>
      buildDisplayedPlannerUserMessage({
        projectName: projectName.trim() || "프로젝트",
        plannerContext: plannerContextPayload,
        selectedTemplate: effectiveTemplate,
        promptSnapshot: promptPackage.slice(0, 50_000),
        userFeedback: "",
        latestRun,
      }),
    [projectName, plannerContextPayload, effectiveTemplate, promptPackage, latestRun],
  );

  const plannerCombinedInputPreview = useMemo(
    () => `${buildPrototypePlannerInstructionBlock()}\n\n${plannerUserMessagePreview}`,
    [plannerUserMessagePreview],
  );

  const confirmExecution = useCallback(() => {
    const rid = latestRun?.id;
    if (!rid) return;
    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeConfirmExecution(rid, { projectId });
        if (r.success && r.data?.run) {
          setLatestRun(r.data.run);
          persistExecutionStateFromPrototypeRun(r.data.run);
        }
        if (r.message) showToast(r.message);
        await postPrototypeRunRefresh(rid, { projectId }).then((x) => {
          if (x.success && x.data?.run) {
            setLatestRun(x.data.run);
            persistExecutionStateFromPrototypeRun(x.data.run);
          }
        });
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, projectId, refreshLatestRun, persistExecutionStateFromPrototypeRun]);

  const regeneratePlan = useCallback(() => {
    const rid = latestRun?.id;
    if (!rid) return;
    void (async () => {
      setProtoBusy(true);
      try {
        const r = await postPrototypeRegeneratePlan(rid, {
          projectId,
          userFeedback: undefined,
          plannerContext: plannerContextPayload,
        });
        if (r.success && r.data?.run) setLatestRun(r.data.run);
        if (r.message) showToast(r.message);
      } finally {
        setProtoBusy(false);
        void refreshLatestRun();
      }
    })();
  }, [latestRun?.id, plannerContextPayload, projectId, refreshLatestRun]);

  const retryWorkUnit = useCallback(
    (mode: "same_prompt" | "regenerate_prompt" | "skip_admin") => (runId: string, order: number) => {
      void (async () => {
        setProtoBusy(true);
        try {
          const r = await postPrototypeRetryWorkUnit(runId, { projectId, workUnitOrder: order, mode });
          if (r.success && r.data?.run) setLatestRun(r.data.run);
          if (r.message) showToast(r.message);
          await postPrototypeRunRefresh(runId, { projectId }).then((x) => {
            if (x.success && x.data?.run) setLatestRun(x.data.run);
          });
        } finally {
          setProtoBusy(false);
          void refreshLatestRun();
        }
      })();
    },
    [projectId, refreshLatestRun],
  );

  const pagesSettingsHref = useMemo(
    () => githubPagesSettingsUrlFromSuggestedPreview(latestRun?.suggestedPreviewUrl),
    [latestRun?.suggestedPreviewUrl],
  );

  const envSettingsHref = useMemo(
    () => `${projectExecutionSettingsHref(projectId, { envNote: "prototype" })}#execution-setup-panel`,
    [projectId],
  );

  const executionEnvironmentModalProject = useMemo((): Project | null => {
    const pid = projectId.trim();
    if (!pid) return null;
    return {
      id: pid,
      name: projectName,
      description: projectDescription || null,
      projectType: "prototype",
      status: "active",
    };
  }, [projectId, projectName, projectDescription]);

  const executionEnvSnapshot = useMemo(
    () =>
      toPrototypeChatEnvSnapshot({
        git: envStatus.git,
        github: envStatus.github,
        cursor: envStatus.cursor,
        connectionTest: envStatus.connectionTest,
      }),
    [envStatus],
  );

  const executionEnvLoading = useMemo(() => isPrototypeExecutionEnvLoading(executionEnvSnapshot), [executionEnvSnapshot]);

  const parsedRequirementsState = useMemo(
    () => parseRequirementsStateJson(requirementsStateJson),
    [requirementsStateJson],
  );

  /** Latest merged requirements JSON — updated synchronously on persist to avoid WIP/timeline race overwrites. */
  const requirementsStateJsonRef = useRef(requirementsStateJson);
  const autoQualityGateInFlightRef = useRef<string | null>(null);
  const autoQualityGateFailedTriggerRef = useRef<string | null>(null);
  const autoQualityGateCompletedTriggerRef = useRef<string | null>(null);
  const quickRunCodeTaskContinuationRef = useRef<string | null>(null);
  const quickRunStuckGithubVerifyRef = useRef<string | null>(null);
  const codeTaskDispatchPreferredTaskIdRef = useRef<string | null>(null);
  const pendingQuickRunQueueDispatchRef = useRef<CodeTaskQueueDispatchRef | null>(null);
  const dbQueuedQuickRunDispatchRef = useRef<string | null>(null);
  const implementationStatusToastSeenRef = useRef(new Set<string>());
  const implementationRuntimePollSuspendedRef = useRef(false);
  const [implementationRuntimeDbBundle, setImplementationRuntimeDbBundle] =
    useState<ImplementationRuntimeBundleView | null>(null);
  const [implementationRuntimeDbDiagnostics, setImplementationRuntimeDbDiagnostics] = useState<
    readonly ImplementationRuntimeDiagnosticsRow[]
  >([]);

  const enrichCodeTaskRunOrchestrationPatch = useCallback(
    (patch: PrototypeExecutionOrchestrationPersistInput): PrototypeExecutionOrchestrationPersistInput => {
      const dispatch = readActiveRuntimeDispatchFromState(
        parseRequirementsStateJson(requirementsStateJsonRef.current) as Record<string, unknown>,
      );
      const execution = parseTaskCursorExecutionV1(patch.taskCursorExecutionV1);
      if (!dispatch || !execution) return patch;
      const runs = syncCodeTaskExecutionRunsFromTaskCursor({
        runs:
          parseCodeTaskExecutionRunsV1(
            patch.codeTaskExecutionRunsV1 ??
              parseRequirementsStateJson(requirementsStateJsonRef.current).codeTaskExecutionRunsV1,
          ) ?? [],
        execution,
        codeTaskId: dispatch.codeTaskId,
        workItemId: dispatch.workItemId,
      });
      return { ...patch, codeTaskExecutionRunsV1: runs };
    },
    [],
  );
  const [activeTaskCursorJob, setActiveTaskCursorJob] = useState<TaskCursorJobSummary | null>(null);
  const activeTaskCursorJobRef = useRef<TaskCursorJobSummary | null>(null);
  activeTaskCursorJobRef.current = activeTaskCursorJob;
  const boardManualPickTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    const incoming = parseRequirementsStateJson(requirementsStateJson);
    const current = parseRequirementsStateJson(requirementsStateJsonRef.current);
    const incomingLogCount = pickPersistentExecutionLogTimelineEntries(incoming.promptTimeline).length;
    const currentLogCount = pickPersistentExecutionLogTimelineEntries(current.promptTimeline).length;
    const incomingTimelineLen = (incoming.promptTimeline ?? []).length;
    const currentTimelineLen = (current.promptTimeline ?? []).length;
    if (
      incomingLogCount >= currentLogCount ||
      incomingTimelineLen <= currentTimelineLen
    ) {
      requirementsStateJsonRef.current = requirementsStateJson;
    }
  }, [requirementsStateJson]);

  const orchestrationAwareRequirementsState = useMemo(
    () =>
      resolveOrchestrationAwareRequirementsState({
        base: parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
      }),
    [parsedRequirementsState, pendingImplementationPatch],
  );
  const orchestrationAwareRequirementsStateRef = useRef(orchestrationAwareRequirementsState);
  orchestrationAwareRequirementsStateRef.current = orchestrationAwareRequirementsState;

  const effectiveCodeTaskExecutionQueueV1 = useMemo(
    () =>
      resolveEffectiveCodeTaskExecutionQueue({
        dbBundle: implementationRuntimeDbBundle,
      }),
    [implementationRuntimeDbBundle],
  );

  const persistedQueueDispatch = useMemo(
    () => resolvePersistedQueueDispatch(orchestrationAwareRequirementsState),
    [orchestrationAwareRequirementsState.implementationRuntimeUiSnapshotV1],
  );

  const applyImplementationRuntimeFetch = useCallback(
    (fetched: Awaited<ReturnType<typeof fetchImplementationRuntime>>) => {
      if (fetched.bundle) setImplementationRuntimeDbBundle(fetched.bundle);
      if (fetched.diagnostics?.length) {
        setImplementationRuntimeDbDiagnostics(fetched.diagnostics);
      }
    },
    [],
  );

  const loadImplementationRuntimeDb = useCallback(
    async (options?: { readonly recover?: boolean }) => {
      const pid = projectId.trim();
      if (!pid) return;
      if (implementationRuntimePollSuspendedRef.current && options?.recover !== true) {
        return;
      }
      try {
        const fetched = await fetchImplementationRuntime(pid, options);
        if (!fetched.success) {
          const message = fetched.message ?? "";
          if (message.includes("DB 스키마가 최신") || message.includes("pnpm db:migrate")) {
            implementationRuntimePollSuspendedRef.current = true;
            showToast(message.split(". ")[0] ?? message);
          }
          return;
        }
        implementationRuntimePollSuspendedRef.current = false;
        applyImplementationRuntimeFetch(fetched);
      } catch {
        // ignore transient poll errors (dev recompile / network)
      }
    },
    [applyImplementationRuntimeFetch, projectId, showToast],
  );

  useEffect(() => {
    void loadImplementationRuntimeDb({ recover: false });
  }, [loadImplementationRuntimeDb]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const legacyCursor = parseTaskCursorExecutionV1(
      orchestrationAwareRequirementsState.taskCursorExecutionV1,
    );
    if (implementationRuntimePollSuspendedRef.current) {
      return;
    }
    if (
      !shouldPollImplementationRuntime({
        bundle: implementationRuntimeDbBundle,
        legacyCursorInFlight: Boolean(
          legacyCursor && isInFlightTaskCursorExecution(legacyCursor),
        ),
      })
    ) {
      return;
    }
    const timer = setInterval(() => {
      void loadImplementationRuntimeDb({ recover: true });
    }, 10_000);
    return () => clearInterval(timer);
  }, [
    implementationRuntimeDbBundle?.currentRun?.runtimeState,
    implementationRuntimeDbBundle?.job?.status,
    loadImplementationRuntimeDb,
    orchestrationAwareRequirementsState.taskCursorExecutionV1,
    projectId,
  ]);

  const prototypeRunSyncSnapshot = useMemo(
    () =>
      deriveImplementationPrototypeRunSyncSnapshot({
        latestRun,
        workUnits: latestRun?.workUnits,
      }),
    [latestRun],
  );

  const implementationStageBoardGateContext = useMemo(() => {
    const pid = projectId.trim();
    const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
    if (!pid || !taskList) return null;
    return buildImplementationStageBoardGateContext({
      projectId: pid,
      taskList,
      executionState: orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      integratedExecutionState:
        orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
      boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
      qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
      previewReady: prototypeRunSyncSnapshot.previewReady,
      implementationReviewStageReadyV1:
        orchestrationAwareRequirementsState.implementationReviewStageReadyV1,
      codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      taskCursorExecutionV1: orchestrationAwareRequirementsState.taskCursorExecutionV1,
      canApplyGit,
      implementationCodeTaskPlanV1: orchestrationAwareRequirementsState.implementationCodeTaskPlanV1,
      cursorWorkItemsV1: orchestrationAwareRequirementsState.cursorWorkItemsV1,
      implementationWorkItemPreflightSummaryV1:
        orchestrationAwareRequirementsState.implementationWorkItemPreflightSummaryV1,
      implementationCodeTaskQualityGateV1:
        orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
      codeTaskExecutionRunsV1: orchestrationAwareRequirementsState.codeTaskExecutionRunsV1 ?? null,
      taskCursorExecutionHistoryV1:
        orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      implementationAutoQualityGateV1:
        orchestrationAwareRequirementsState.implementationAutoQualityGateV1 ?? null,
      activeTaskCursorJob,
      implementationExecutionJobsV1:
        orchestrationAwareRequirementsState.implementationExecutionJobsV1 ?? null,
    });
  }, [
    projectId,
    orchestrationAwareRequirementsState,
    prototypeRunSyncSnapshot.previewReady,
    canApplyGit,
    activeTaskCursorJob,
  ]);

  const persistedDraftUpdatedAtRef = useRef<string | null | undefined>(undefined);
  const persistedTaskPlanCreatedAtRef = useRef<string | null | undefined>(undefined);
  const implementationSessionActiveRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    setPendingImplementationPatch({});
    implementationSessionActiveRef.current = undefined;
  }, [projectId]);

  useEffect(() => {
    const nextDraftAt = parsedRequirementsState.implementationWorkPlanDraftV1?.updatedAt ?? null;
    const nextTaskAt = parsedRequirementsState.implementationTaskPlanV1?.createdAt ?? null;
    const nextSessionActive = hasActiveImplementationExecutionSession(parsedRequirementsState);
    const prevSessionActive = implementationSessionActiveRef.current;
    if (
      shouldClearPendingImplementationPatch({
        prevPersistedDraftUpdatedAt: persistedDraftUpdatedAtRef.current,
        nextPersistedDraftUpdatedAt: nextDraftAt,
        prevPersistedTaskPlanCreatedAt: persistedTaskPlanCreatedAtRef.current,
        nextPersistedTaskPlanCreatedAt: nextTaskAt,
        prevImplementationSessionActive: prevSessionActive,
        nextImplementationSessionActive: nextSessionActive,
      })
    ) {
      setPendingImplementationPatch(null);
      setImplementationRuntimeDbBundle(null);
      setActiveTaskCursorJob(null);
      lastServerTaskCursorJobSyncFingerprintRef.current = "";
    }
    persistedDraftUpdatedAtRef.current = nextDraftAt;
    persistedTaskPlanCreatedAtRef.current = nextTaskAt;
    implementationSessionActiveRef.current = nextSessionActive;
  }, [
    parsedRequirementsState,
    parsedRequirementsState.implementationWorkPlanDraftV1?.updatedAt,
    parsedRequirementsState.implementationTaskPlanV1?.createdAt,
  ]);

  const effectiveImplementationState = useMemo(
    () =>
      resolveEffectiveImplementationState({
        parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
        envOk: canRequestGeneration.envOk,
        designOk: canRequestGeneration.designOk,
        latestRun,
        plannerRunning: isPlannerRunning,
        plannerCreatePending,
        protoBusy,
      }),
    [
      parsedRequirementsState,
      pendingImplementationPatch,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      latestRun,
      isPlannerRunning,
      plannerCreatePending,
      protoBusy,
    ],
  );

  const applyPendingFromOrchestrationPatch = useCallback(
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => {
      const incoming = mergePendingImplementationPatchFromOrchestration(patch);
      if (!incoming) return;
      setPendingImplementationPatch((prev) => {
        const merged = mergePendingImplementationPatch(prev, incoming);
        pendingImplementationPatchRef.current = merged;
        return merged;
      });
    },
    [],
  );
  useEffect(() => {
    applyPendingFromOrchestrationPatchRef.current = applyPendingFromOrchestrationPatch;
  }, [applyPendingFromOrchestrationPatch]);

  const recordQuickRunClientEvent = useCallback(
    (input: {
      readonly phase: string;
      readonly detail: string;
      readonly toastMessage?: string;
      readonly selectedCount?: number;
    }) => {
      const pid = projectId.trim();
      if (input.toastMessage?.trim()) {
        showToast(input.toastMessage.trim());
      }
      const imp = resolveOrchestrationAwareRequirementsState({
        base: parseRequirementsStateJson(requirementsStateJsonRef.current),
        pendingPatch: pendingImplementationPatchRef.current,
      });
      const nowIso = new Date().toISOString();
      const entry = buildImplementationExecutionLogTimelineEntry({
        action: "implementation_quick_run_client_trace",
        fields: {
          phase: input.phase,
          message: input.detail,
          ...(input.selectedCount != null ? { selectedCount: input.selectedCount } : {}),
        },
        nowIso,
      });
      const promptTimeline = appendPromptTimeline(imp.promptTimeline, entry);
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline });
      void persistChatToDb(undefined, { promptTimeline }, undefined, { force: true });
      if (pid) {
        void postImplementationRuntimeAction({
          projectId: pid,
          action: "client_trace",
          clientTrace: {
            phase: input.phase,
            detail: input.detail,
            selectedCount: input.selectedCount,
          },
        });
      }
    },
    [persistChatToDb, projectId, showToast],
  );

  const executionArtifacts = useMemo(
    () => pickExecutionStateArtifacts(parsedRequirementsState),
    [parsedRequirementsState],
  );

  const planningSlotDefinitions = useMemo(
    () =>
      buildDynamicServicePlanningSlotDefinitions({
        projectName: projectName.trim() || "프로젝트",
        projectDescription: projectDescription ?? "",
      }),
    [projectName, projectDescription],
  );

  const implementationBootstrapInput = useMemo(
    () =>
      buildImplementationBootstrapInput({
        envLoading: executionEnvLoading,
        projectId,
        env: executionEnvSnapshot,
        envOk: canRequestGeneration.envOk,
        envSettingsHref,
        featureDraftTitles: featureDraftTitles ?? [],
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
        designOk: canRequestGeneration.designOk,
        orchestration: parsedRequirementsState.singleChatOrchestrationV1,
        slotDefinitions: planningSlotDefinitions,
        implementationSeedV1: orchestrationAwareRequirementsState.implementationSeedV1,
        implementationTaskListV1: orchestrationAwareRequirementsState.implementationTaskListV1,
        implementationTaskPlanV1: orchestrationAwareRequirementsState.implementationTaskPlanV1,
        cursorWorkItemsV1: orchestrationAwareRequirementsState.cursorWorkItemsV1,
        fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
        promptTimeline: orchestrationAwareRequirementsState.promptTimeline,
        executionSetup: executionSetupRow,
      }),
    [
      executionEnvLoading,
      projectId,
      executionEnvSnapshot,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      featureDraftTitles,
      executionArtifacts,
      parsedRequirementsState.singleChatOrchestrationV1,
      orchestrationAwareRequirementsState.implementationSeedV1,
      orchestrationAwareRequirementsState.implementationTaskListV1,
      orchestrationAwareRequirementsState.implementationTaskPlanV1,
      orchestrationAwareRequirementsState.cursorWorkItemsV1,
      parsedRequirementsState.fastPlanDraftV1,
      orchestrationAwareRequirementsState.promptTimeline,
      planningSlotDefinitions,
      executionSetupRow,
    ],
  );

  useEffect(() => {
    const pid = projectId.trim();
    const taskList = parsedRequirementsState.implementationTaskListV1;
    if (!pid || !parsedRequirementsState.implementationSeedV1) return;
    if (!hasImplementationTaskListReady(taskList)) return;
    if ((parsedRequirementsState.cursorWorkItemsV1?.length ?? 0) > 0) return;

    const recovery = buildImplementationEntryCursorWorkItemsRecovery({
      projectId: pid,
      taskList: taskList!,
      existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
    });
    if (!recovery.regenerated) return;

    const nowIso = new Date().toISOString();
    void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
      cursorWorkItemsV1: [...recovery.cursorWorkItems],
      promptTimeline: [
        ...(parsedRequirementsState.promptTimeline ?? []),
        buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({
          projectId: pid,
          taskCount: taskList!.tasks.length,
          developerTaskCount: taskList!.roleSummary?.developer ?? 0,
          nowIso,
        }),
      ],
    });
  }, [
    projectId,
    parsedRequirementsState.implementationTaskListV1,
    parsedRequirementsState.cursorWorkItemsV1,
    parsedRequirementsState.promptTimeline,
    requirementsStateJson,
    persistChatToDb,
  ]);

  const implementationSeedReady = useMemo(() => {
    const summary = summarizeImplementationSeedStatus({
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      definitions: planningSlotDefinitions,
      lifecycleStatus: parsedRequirementsState.implementationSeedV1?.lifecycleStatus,
    });
    return summary.ready || Boolean(parsedRequirementsState.implementationSeedV1?.readiness?.ready);
  }, [
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.implementationSeedV1,
    planningSlotDefinitions,
  ]);

  const implementationStageBoardInput = useMemo(() => {
    const pid = projectId.trim();
    const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
    if (!pid || !taskList) return null;
    return {
      projectId: pid,
      taskList,
      executionState: orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      integratedExecutionState:
        orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
      boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
      qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
      previewReady: prototypeRunSyncSnapshot.previewReady,
      implementationReviewStageReadyV1:
        orchestrationAwareRequirementsState.implementationReviewStageReadyV1,
      reviewStageUserTestSessionV1: orchestrationAwareRequirementsState.reviewStageUserTestSessionV1,
      reviewStageUserFeedbackListV1:
        orchestrationAwareRequirementsState.reviewStageUserFeedbackListV1,
      codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      taskCursorExecutionV1: orchestrationAwareRequirementsState.taskCursorExecutionV1,
      implementationAutoQualityGateV1: orchestrationAwareRequirementsState.implementationAutoQualityGateV1,
      implementationCodeTaskPlanV1: orchestrationAwareRequirementsState.implementationCodeTaskPlanV1,
      codeTaskExecutionRunsV1: orchestrationAwareRequirementsState.codeTaskExecutionRunsV1 ?? null,
      taskCursorExecutionHistoryV1:
        orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      canApplyGit,
    };
  }, [
    projectId,
    orchestrationAwareRequirementsState,
    prototypeRunSyncSnapshot.previewReady,
    canApplyGit,
  ]);

  const implementationBoard = implementationStageBoardGateContext?.board ?? null;
  const boardPanelVisible = implementationBoard != null;
  const boardPanelVisibleRef = useRef(boardPanelVisible);
  boardPanelVisibleRef.current = boardPanelVisible;

  const isImplementationToolbarMobileCompact = useImplementationToolbarMobileBreakpoint();

  const implementationBoardVisibleActionLabels = useMemo(() => {
    if (!boardPanelVisible || !implementationBoard || !implementationStageBoardInput) return [];
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: effectiveImplementationState.latestRun,
      workUnits: effectiveImplementationState.latestRun?.workUnits,
    });
    const status = deriveImplementationStageStatus(
      effectiveImplementationState,
      implementationStageBoardInput.executionState,
    );
    const actions = dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        status,
        implementationStageBoardInput.executionState,
        prototypeSnapshot,
        implementationStageBoardInput,
        {
          implementationSeedV1: effectiveImplementationState.implementationSeedV1,
          implementationTaskListV1: implementationStageBoardInput.taskList,
        },
      ),
    );
    return extractBoardVisibleActionLabels(actions);
  }, [
    boardPanelVisible,
    implementationBoard,
    implementationStageBoardInput,
    effectiveImplementationState,
  ]);

  const implementationVisibleActionLabels = useMemo(() => {
    const labels = implementationBootstrapInput
      ? implementationEntryChipsForBootstrap(implementationBootstrapInput)
      : [];
    return prioritizeImplementationChipsForState(
      labels,
      effectiveImplementationState,
      orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      implementationStageBoardInput,
    );
  }, [
    implementationBootstrapInput,
    effectiveImplementationState,
    orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
    implementationStageBoardInput,
  ]);

  const runImplementationStageActionRef = useRef<
    (actionId: ImplementationStageActionId) => ImplementationStageActionRunResult
  >(() => ({ outcome: "blocked", message: "구현단계 action을 준비하는 중입니다." }));
  const startImplementationQuickRunRef = useRef<
    () => Promise<ImplementationStageActionRunResult>
  >(async () => ({
    outcome: "blocked",
    message: "Quick 실행을 준비하는 중입니다.",
  }));
  const persistImplementationStageActionRunRef = useRef<(run: ImplementationStageActionRun) => void>(() => {});

  const derivedChatMessages = useMemo(
    () =>
      buildPrototypeChatMessages({
        omitEnvReadinessCard: true,
        env: executionEnvSnapshot,
        canRequestGenerationEnvOk: canRequestGeneration.envOk,
        canRequestGenerationDesignOk: canRequestGeneration.designOk,
        envSettingsHref,
        templateChipTemplates: [],
        recommendedTemplateId: analysis.recommendedTemplate,
        templateConfirmed,
        templatePlanningReady,
        prePlanGate,
        latestRun,
        awaitingExecutionConfirm,
        isPlannerRunning,
        isRunningState,
        isCancelled,
        isFailed: workPipelineFailed,
        isDeployFailed: deployFailedOnly,
        isCompleted,
        isDeployPhase: deployPhase,
        automationAvailable,
        previewUrl,
        pagesSettingsHref,
        pagesDeployWorkflowRunUrl: latestRun?.pagesDeployWorkflowRunUrl ?? null,
        protoBusy,
        plannerCreatePending,
        plannerProgressStep,
        projectId,
      }),
    [
      executionEnvSnapshot,
      canRequestGeneration.envOk,
      canRequestGeneration.designOk,
      envSettingsHref,
      analysis.recommendedTemplate,
      templateConfirmed,
      templatePlanningReady,
      prePlanGate,
      latestRun,
      awaitingExecutionConfirm,
      isPlannerRunning,
      plannerCreatePending,
      plannerProgressStep,
      isRunningState,
      isCancelled,
      workPipelineFailed,
      deployFailedOnly,
      isCompleted,
      deployPhase,
      automationAvailable,
      previewUrl,
      pagesSettingsHref,
      protoBusy,
      projectId,
    ],
  );

  const timelineCardsForMerge = useMemo(() => {
    if (!awaitingExecutionConfirm || !latestRun?.id) return timelineCards;
    return timelineCards.filter((c) => !(c.kind === "plan_ready" && c.runId === latestRun.id));
  }, [timelineCards, awaitingExecutionConfirm, latestRun?.id]);

  const mergedChatMessages = useMemo(
    () => mergeTimelineArchiveIntoLive(derivedChatMessages, buildTimelineArchiveMessages(timelineCardsForMerge)),
    [derivedChatMessages, timelineCardsForMerge],
  );

  const ideationSummaryForChat = useMemo(
    () =>
      ideationAssets
        .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 8000),
    [ideationAssets],
  );

  const actorFlowSummaryForChat = useMemo(
    () => flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n").slice(0, 8000),
    [flowSteps],
  );

  const buildStatusQueryOperationalResult = useCallback(
    (intent: ImplementationStatusQueryIntent): PrototypeExecutionOperationalSendResult | null => {
      if (intent === "none" || !implementationBootstrapInput) return null;
      const prior = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson).messages ?? [];
      if (intent === "role_check_details" && hasImplementationRoleCheckDetailsShown(prior)) {
        showToast("역할별 점검 결과가 이미 표시되어 있습니다.");
        return "handled";
      }
      const roleCheckSummary = buildImplementationRoleCheckSummary(implementationBootstrapInput);
      const aiMessage = buildImplementationStatusQueryMessage({
        intent,
        summaryInput: implementationBootstrapInput,
        roleCheckSummary,
      });
      if (!aiMessage) return "handled";
      return {
        kind: "status_query",
        aiMessage,
        timelineEntries: [
          buildImplementationStatusQueryTimelineEntry({
            query: intent,
            summaryInput: implementationBootstrapInput,
            roleCheckSummary,
          }),
        ],
      };
    },
    [implementationBootstrapInput, requirementsStateJson, showToast],
  );

  const implementationOperationalHandlers = useMemo(
    () => ({
      appendNotice: (message: string) => appendExecutionNoticeRef.current(message),
      showToast,
      focusChatInput: () => {
        queueMicrotask(() => chatInputRef.current?.focus());
      },
      startWorkPlanGeneration: () => startWorkPlanGenerationFromChat(),
      openPlannerPrompt: () => setPlannerPromptModalOpen(true),
      openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
      openArtifactHub: () => setArtifactHubOpen(true),
      buildStatusQueryResult: buildStatusQueryOperationalResult,
      persistRequirementPatch: (patch: import("@/lib/prototype/implementationUserFeedback").ImplementationUserFeedbackPatchV1) => {
        const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        const orchPatch = buildImplementationUserFeedbackOrchestrationPatch({
          requirementsStateJson,
          patch,
          nowIso: patch.createdAt,
        });
        void persistChatToDb(
          {
            messages: resolved.messages ?? [],
            slots: resolved.slots ?? [],
            answers: resolved.answers ?? {},
            currentSlotKey: resolved.currentSlotKey ?? null,
          },
          orchPatch,
        );
      },
    }),
    [
      showToast,
      buildStatusQueryOperationalResult,
      requirementsStateJson,
      persistChatToDb,
      startWorkPlanGenerationFromChat,
    ],
  );

  const executionSingleChat = usePrototypeExecutionSingleChat({
    projectId,
    projectName: projectName || "프로젝트",
    projectDescription,
    requirementsStateJson,
    mergedBuiltMessages: mergedChatMessages,
    envOk: canRequestGeneration.envOk,
    templateName: effectiveTemplateDef?.nameKo ?? effectiveTemplate,
    ideationSummary: ideationSummaryForChat,
    actorFlowSummary: actorFlowSummaryForChat,
    protoBusy,
    inputBlocked: isMessageInputBlocked,
    implementationBootstrapInput,
    envLoading: executionEnvLoading,
    conversationResetNonce: implementationConversationResetNonce,
    onPersistStateJson: (patch) => {
      applyPendingFromOrchestrationPatch(patch.orchestration);
      const parsed = parseRequirementsStateJson(requirementsStateJson);
      const timeline = mergePromptTimelineWithBootstrapEntries({
        baseTimeline: parsed.promptTimeline,
        orchestrationTimeline: patch.orchestration?.promptTimeline,
        bootstrapTimeline: patch.bootstrapTimeline,
      });
      const orchestrationPatch = {
        ...(patch.orchestration ?? {}),
        ...(timeline.length ? { promptTimeline: timeline } : {}),
      };
      const hasOrchestrationPatch = Object.values(orchestrationPatch).some(
        (value) => value !== undefined && value !== null,
      );
      void persistChatToDb(
        {
          messages: patch.messages,
          slots: patch.slots,
          answers: patch.answers,
          currentSlotKey: patch.currentSlotKey,
        },
        hasOrchestrationPatch ? orchestrationPatch : undefined,
      );
    },
    onOperationalSend: async (text, userMsg) => {
      const run = latestRun;
      if (run?.id && run.status === "WORK_UNITS_READY" && run.workUnitsExecutionConfirmed !== true) {
        setProtoBusy(true);
        try {
          const r = await postPrototypeRegeneratePlan(run.id, {
            projectId,
            userFeedback: text,
            plannerContext: plannerContextPayload,
          });
          if (r.success && r.data?.run) setLatestRun(r.data.run);
          if (r.message) showToast(r.message);
        } finally {
          setProtoBusy(false);
          void refreshLatestRun();
        }
        return "handled";
      }

      const pid = projectId.trim();
      return resolveImplementationOperationalSend(
        {
          text,
          userMsg,
          isDraftGenerationComplete,
          isRunningState,
          envOk: canRequestGeneration.envOk,
          designOk: canRequestGeneration.designOk,
          requirementsStateJson,
          projectId: pid,
          projectArtifacts: executionArtifacts.projectArtifacts,
          orchestration: parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: planningSlotDefinitions,
          implementationSeedV1: parsedRequirementsState.implementationSeedV1,
          implementationWorkPlanDraftV1: effectiveImplementationState.implementationWorkPlanDraftV1,
          promptTimeline: parsedRequirementsState.promptTimeline,
          stageActionOrchestrator: pid
            ? {
                projectId: pid,
                effectiveState: effectiveImplementationState,
                execute: (actionId) => runImplementationStageActionRef.current(actionId),
              }
            : undefined,
          routeParams: {
            text,
            visibleActionLabels: implementationVisibleActionLabels,
            envOk: canRequestGeneration.envOk,
            templatePlanningReady,
            implementationSeedReady,
            hasWorkUnits: (latestRun?.workUnits?.length ?? 0) > 0,
            isPlannerRunning,
            plannerCreatePending,
            protoBusy,
            projectName: projectName || "프로젝트",
            projectDescription,
            latestRunStatus: latestRun?.status ?? null,
            enableLlmClassifier: true,
          },
        },
        implementationOperationalHandlers,
      );
    },
    onOperationalAfterPersist: (action) => {
      if (action === "start_prototype_work_plan") {
        startWorkPlanGenerationFromChat();
      }
    },
    onOperationalStageActionRun: (run) => {
      persistImplementationStageActionRun(run);
      if ((run.status === "failed" || run.status === "blocked" || run.status === "no_op") && run.message) {
        showToast(run.message);
      }
    },
  });

  const appendAiNoticeForImplementation = useCallback(
    (content: string) => {
      const text = String(content ?? "").trim();
      if (!text) return;
      const pid = projectId.trim();
      const pipeline = integrationPipelineClientResultRef.current;
      const integratedReady =
        (pid &&
          resolveIntegratedAppPreviewReadyFromOrchestration({
            projectId: pid,
            orchestration: orchestrationAwareRequirementsStateRef.current,
          })) ||
        pipeline?.previewReady === true ||
        pipeline?.status === "integrated_app_preview_ready";
      if (
        integratedReady &&
        (isLegacyCodeTaskPreviewScopeNoticeContent(text) || isLegacyContinuePreviewMessage(text))
      ) {
        console.info(`[implementation] ${COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION}`, {
          status: pipeline?.status,
          previewReady: pipeline?.previewReady,
        });
        return;
      }
      if (boardPanelVisibleRef.current) {
        if (integratedReady) return;
        setImplementationStageNoticeModal({ body: text });
        return;
      }
      executionSingleChat.appendAiNotice(text);
    },
    [executionSingleChat, projectId],
  );

  const appendImplementationExecutionNotice = useCallback(
    (content: string) => {
      if (shouldSuppressImplementationStatusMessage({ content })) return;
      const pid = projectId.trim();
      if (
        pid &&
        isLegacyCodeTaskPreviewScopeNoticeContent(content) &&
        (resolveIntegratedAppPreviewReadyFromOrchestration({
          projectId: pid,
          orchestration: orchestrationAwareRequirementsStateRef.current,
        }) ||
          integrationPipelineClientResultRef.current?.previewReady === true ||
          integrationPipelineClientResultRef.current?.status === "integrated_app_preview_ready")
      ) {
        return;
      }
      appendAiNoticeForImplementation(content);
    },
    [appendAiNoticeForImplementation, projectId],
  );

  const showImplementationToast = useCallback(
    (msg: string, displayMs = 3200) => {
      const pid = projectId.trim();
      const pipeline = integrationPipelineClientResultRef.current;
      const integratedFromOrchestration = pid
        ? resolveIntegratedAppPreviewReadyFromOrchestration({
            projectId: pid,
            orchestration: orchestrationAwareRequirementsStateRef.current,
          })
        : false;
      const toast = resolveIntegrationPipelineUserToast({
        status: pipeline?.status,
        previewReady: pipeline?.previewReady,
        integratedAppPreviewReady:
          integratedFromOrchestration ||
          pipeline?.previewReady === true ||
          pipeline?.status === "integrated_app_preview_ready",
        message: msg,
        serverSaved: true,
      });
      if (!toast.show || !toast.message) return;
      const key = buildImplementationStatusToastDedupeKey(toast.message);
      if (key) {
        if (implementationStatusToastSeenRef.current.has(key)) return;
        implementationStatusToastSeenRef.current.add(key);
      }
      showToast(toast.message, displayMs);
    },
    [showToast, projectId],
  );

  appendExecutionNoticeRef.current = appendImplementationExecutionNotice;

  const prioritizedChatMessages = useMemo(() => {
    if (boardPanelVisible) return [];
    const prioritized = executionSingleChat.chatMessages.map((m) => {
      const suggestions = (m.meta as any)?.interviewSuggestions;
      if (!Array.isArray(suggestions) || suggestions.length < 2) return m;
      return {
        ...m,
        meta: {
          ...m.meta,
          interviewSuggestions: prioritizeImplementationChipsForState(
            suggestions as readonly string[],
            effectiveImplementationState,
            orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
            implementationStageBoardInput,
          ),
        },
      };
    });
    return filterBoardDuplicateChatInterviewSuggestions(
      collapseImplementationBoardChatMessagesForPanelView(prioritized, boardPanelVisible),
      boardPanelVisible,
      implementationBoardVisibleActionLabels,
    );
  }, [
    boardPanelVisible,
    executionSingleChat.chatMessages,
    effectiveImplementationState,
    orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
    implementationStageBoardInput,
    boardPanelVisible,
    implementationBoardVisibleActionLabels,
  ]);
  // CTA priority is display-only. Persisted order is used for export/summary/evidence.

  /** Shared persist path for implementation stage actions (expand to full applyImplementationStageActionResult later). */
  const applyImplementationOrchestrationResult = useCallback(
    (
      input: {
        readonly messages: readonly RequirementsMessage[];
        readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
      },
      options?: { readonly persist?: boolean },
    ) => {
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const chatPatch = {
        messages: input.messages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      };
      const prior = parseRequirementsStateJson(requirementsStateJsonRef.current);
      const mergedWithoutAutoLog = buildPrototypeExecutionOrchestrationPersistPatch(requirementsStateJsonRef.current, {
        chat: chatPatch,
        ...input.orchestrationPatch,
      });
      const promptTimeline = mergeImplementationExecutionLogTimeline({
        prior,
        next: mergedWithoutAutoLog,
        patch: input.orchestrationPatch,
      });
      const mergedBase =
        promptTimeline.length > 0
          ? { ...mergedWithoutAutoLog, promptTimeline }
          : mergedWithoutAutoLog;
      const mergedRequirementsState = mergeRequirementsStateWithRuntime({
        projectId: projectId.trim(),
        state: mergedBase as Record<string, unknown>,
      }) as typeof mergedBase;
      const orchestrationPatchWithTimeline: PrototypeExecutionOrchestrationPersistInput = {
        ...input.orchestrationPatch,
        ...(promptTimeline.length ? { promptTimeline } : {}),
      };
      requirementsStateJsonRef.current = mergedRequirementsState;
      applyPendingFromOrchestrationPatch(orchestrationPatchWithTimeline);
      executionSingleChat.applyPersistedMessages(input.messages);
      if (options?.persist !== false) {
        const persistSeq = ++orchestrationPersistSeqRef.current;
        void persistChatToDb(chatPatch, orchestrationPatchWithTimeline, persistSeq);
      } else {
        queueMicrotask(() => {
          onRequirementsStateJsonChange?.(mergedRequirementsState);
        });
      }
    },
    [
      requirementsStateJson,
      executionSingleChat,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      onRequirementsStateJsonChange,
    ],
  );

  const applyImplementationOrchestrationResultRef = useRef(applyImplementationOrchestrationResult);
  useEffect(() => {
    applyImplementationOrchestrationResultRef.current = applyImplementationOrchestrationResult;
  }, [applyImplementationOrchestrationResult]);

  const executionSingleChatMessagesRef = useRef(executionSingleChat.chatMessages);
  executionSingleChatMessagesRef.current = executionSingleChat.chatMessages;

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || implementationRuntimePollSuspendedRef.current) return;

    const quickRun = parseImplementationQuickRunV1(
      orchestrationAwareRequirementsState.implementationQuickRunV1,
    );
    if (quickRun?.status !== "running") {
      dbQueuedQuickRunDispatchRef.current = null;
      return;
    }

    const job = implementationRuntimeDbBundle?.job;
    const dbRun = implementationRuntimeDbBundle?.currentRun;
    if (!job || job.status !== "running" || dbRun?.runtimeState !== "queued") {
      if (dbRun?.runtimeState !== "queued") {
        dbQueuedQuickRunDispatchRef.current = null;
      }
      return;
    }

    const dedupeKey = `${dbRun.id}:${dbRun.codeTaskId}`;
    if (dbQueuedQuickRunDispatchRef.current === dedupeKey) {
      return;
    }
    dbQueuedQuickRunDispatchRef.current = dedupeKey;

    void (async () => {
      try {
        const res = await credentialsIncludeFetch(
          "/api/prototype/implementation-runtime/continue-quick-run",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: pid,
              mode: "db_queued_auto_dispatch",
            }),
          },
        );
        const json = (await res.json()) as {
          success?: boolean;
          outcome?: string;
          reason?: string;
          orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
        };
        if (json.orchestrationPatch) {
          applyImplementationOrchestrationResultRef.current({
            messages: executionSingleChatMessagesRef.current,
            orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch),
          });
        }
        if (json.outcome === "dispatched") {
          showImplementationToast(`다음 CodeTask(${dbRun.codeTaskId}) Cursor 실행을 시작했습니다.`);
          void loadImplementationRuntimeDb({ recover: false });
        } else if (json.reason && json.outcome !== "skipped") {
          showImplementationToast(formatQuickRunContinuationReason(json.reason));
          dbQueuedQuickRunDispatchRef.current = null;
        }
      } catch {
        dbQueuedQuickRunDispatchRef.current = null;
      }
    })();
  }, [
    enrichCodeTaskRunOrchestrationPatch,
    implementationRuntimeDbBundle?.currentRun?.codeTaskId,
    implementationRuntimeDbBundle?.currentRun?.id,
    implementationRuntimeDbBundle?.currentRun?.runtimeState,
    implementationRuntimeDbBundle?.job?.status,
    loadImplementationRuntimeDb,
    orchestrationAwareRequirementsState.implementationQuickRunV1,
    orchestrationAwareRequirementsState.taskCursorExecutionV1,
    projectId,
    showImplementationToast,
  ]);

  const lastServerTaskCursorJobSyncFingerprintRef = useRef("");

  useEffect(() => {
    if (!isServerTaskCursorPolling()) return;
    const pid = projectId.trim();
    if (!pid) return;
    if (!shouldSyncTaskCursorServerJobPollState(requirementsStateJsonRef.current)) {
      if (activeTaskCursorJobRef.current) setActiveTaskCursorJob(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      if (implementationResetInFlightRef.current) return;
      try {
        const res = await credentialsIncludeFetch(
          `/api/prototype/task-cursor/jobs?projectId=${encodeURIComponent(pid)}`,
        );
        const json = (await res.json()) as {
          success?: boolean;
          activeJob?: TaskCursorJobSummary | null;
          orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
        };
        if (cancelled || !json.success || implementationResetInFlightRef.current) return;
        if (!shouldSyncTaskCursorServerJobPollState(requirementsStateJsonRef.current)) {
          setActiveTaskCursorJob(null);
          return;
        }
        setActiveTaskCursorJob(json.activeJob ?? null);
        if (json.orchestrationPatch) {
          const syncFingerprint = buildTaskCursorJobOrchestrationSyncFingerprint(json.orchestrationPatch);
          if (syncFingerprint === lastServerTaskCursorJobSyncFingerprintRef.current) return;
          lastServerTaskCursorJobSyncFingerprintRef.current = syncFingerprint;
          applyImplementationOrchestrationResultRef.current({
            messages: executionSingleChatMessagesRef.current,
            orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch),
          });
        }
      } catch {
        // ignore refresh errors
      }
    };
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    projectId,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
  ]);

  useEffect(() => {
    lastServerTaskCursorJobSyncFingerprintRef.current = "";
  }, [
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
  ]);

  const triggerImplementationAutoQualityGate = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    const freshState = parseRequirementsStateJson(requirementsStateJsonRef.current);
    const execution = parseTaskCursorExecutionV1(freshState.taskCursorExecutionV1);
    if (!execution) return;
    const clientInput = {
      projectId: pid,
      taskCursorExecutionV1: execution,
      implementationTaskListV1: freshState.implementationTaskListV1,
      implementationTaskExecutionStateV1: freshState.implementationTaskExecutionStateV1,
      implementationQualityGateResultsV1: freshState.implementationQualityGateResultsV1,
      implementationAutoQualityGateV1: freshState.implementationAutoQualityGateV1,
      implementationAutoQualityGateHistoryV1: freshState.implementationAutoQualityGateHistoryV1,
      cursorWorkItemsV1: freshState.cursorWorkItemsV1 ?? [],
      promptTimeline: freshState.promptTimeline,
      codeTaskExecutionRunsV1: freshState.codeTaskExecutionRunsV1,
    };
    if (!shouldTriggerImplementationAutoQualityGateClient(clientInput)) {
      autoQualityGateCompletedTriggerRef.current = buildImplementationAutoQualityGateTriggerKey(execution);
      return;
    }
    const triggerKey = buildImplementationAutoQualityGateTriggerKey(execution);
    if (autoQualityGateCompletedTriggerRef.current === triggerKey) return;
    if (autoQualityGateFailedTriggerRef.current === triggerKey) return;
    if (autoQualityGateInFlightRef.current === triggerKey) return;
    autoQualityGateInFlightRef.current = triggerKey;
    try {
      const outcome = await runImplementationAutoQualityGateClient(clientInput);
      if (!outcome.ok) {
        autoQualityGateFailedTriggerRef.current = triggerKey;
        if (outcome.message) {
          appendImplementationExecutionNotice(outcome.message);
          showImplementationToast(outcome.message);
        }
        return;
      }
      autoQualityGateFailedTriggerRef.current = null;
      if (outcome.orchestrationPatch) {
        applyImplementationOrchestrationResultRef.current({
          messages: executionSingleChatMessagesRef.current,
          orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(outcome.orchestrationPatch),
        });
      }
      const afterPatch = parseRequirementsStateJson(requirementsStateJsonRef.current);
      const afterExecution = parseTaskCursorExecutionV1(afterPatch.taskCursorExecutionV1);
      const stillNeedsGate =
        afterExecution &&
        shouldTriggerImplementationAutoQualityGateClient({
          projectId: pid,
          taskCursorExecutionV1: afterExecution,
          implementationAutoQualityGateV1: afterPatch.implementationAutoQualityGateV1,
          codeTaskExecutionRunsV1: afterPatch.codeTaskExecutionRunsV1,
        });
      if (outcome.status === "skipped" || !stillNeedsGate) {
        autoQualityGateCompletedTriggerRef.current = triggerKey;
      }
      if (outcome.message) {
        appendImplementationExecutionNotice(outcome.message);
        showImplementationToast(outcome.message);
      }
    } finally {
      if (autoQualityGateInFlightRef.current === triggerKey) {
        autoQualityGateInFlightRef.current = null;
      }
    }
  }, [
    projectId,
    appendImplementationExecutionNotice,
    showImplementationToast,
  ]);

  const triggerImplementationAutoQualityGateRef = useRef(triggerImplementationAutoQualityGate);
  useEffect(() => {
    triggerImplementationAutoQualityGateRef.current = triggerImplementationAutoQualityGate;
  }, [triggerImplementationAutoQualityGate]);

  const autoQualityGateEffectSignal = useMemo(() => {
    const execution = parseTaskCursorExecutionV1(
      orchestrationAwareRequirementsState.taskCursorExecutionV1,
    );
    const run = resolveCodeTaskRunForAutoQualityGateClient({
      taskCursorExecutionV1: execution,
      codeTaskExecutionRunsV1: orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    });
    const autoGate = orchestrationAwareRequirementsState.implementationAutoQualityGateV1;
    const autoGateStatus =
      autoGate && typeof autoGate === "object" && "status" in autoGate
        ? String((autoGate as { status?: string }).status ?? "")
        : "";
    return [
      execution?.taskId ?? "",
      execution?.status ?? "",
      String(execution?.commitSha ?? "").trim(),
      run?.status ?? "",
      autoGateStatus,
      String(autoGate && typeof autoGate === "object" && "sourceCommitSha" in autoGate
        ? (autoGate as { sourceCommitSha?: string }).sourceCommitSha ?? ""
        : "").trim(),
    ].join("|");
  }, [
    orchestrationAwareRequirementsState.taskCursorExecutionV1,
    orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    orchestrationAwareRequirementsState.implementationAutoQualityGateV1,
  ]);

  useEffect(() => {
    autoQualityGateFailedTriggerRef.current = null;
    autoQualityGateCompletedTriggerRef.current = null;
  }, [autoQualityGateEffectSignal]);

  useEffect(() => {
    void triggerImplementationAutoQualityGateRef.current();
  }, [autoQualityGateEffectSignal]);

  const recoverServerQuickRunContinuationIfNeeded = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    const timeline = orchestrationAwareRequirementsState.promptTimeline ?? [];
    const recentServerContinuation = timeline.some((entry, idx) => {
      if (idx < timeline.length - 40) return false;
      const action = String(entry.action ?? "");
      if (
        action !== "quick_run_next_dispatch_executed" &&
        action !== "quick_run_next_dispatch_planned"
      ) {
        return false;
      }
      const created = Date.parse(String(entry.createdAt ?? ""));
      return Number.isFinite(created) && Date.now() - created < 120_000;
    });
    if (recentServerContinuation) return;

    const state = parseRequirementsStateJson(requirementsStateJsonRef.current);
    const execution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
    const autoGate = parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1);
    const quickRun = parseImplementationQuickRunV1(state.implementationQuickRunV1);
    const runs =
      parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ??
      parseCodeTaskExecutionRunsV1(orchestrationAwareRequirementsState.codeTaskExecutionRunsV1) ??
      [];
    if (
      !execution ||
      !autoGate ||
      autoGate.status !== "passed" ||
      !quickRun ||
      !shouldPlanQuickRunCodeTaskContinuationAfterAutoGate({
        quickRun,
        taskCursorExecution: execution,
        autoGate,
        runs,
        codeTaskPlan: state.implementationCodeTaskPlanV1,
        taskList: state.implementationTaskListV1,
        cursorWorkItems: state.cursorWorkItemsV1,
        dbBundle: implementationRuntimeDbBundle,
      })
    ) {
      return;
    }
    if (execution && isActiveTaskCursorExecution(execution)) return;

    try {
      const res = await credentialsIncludeFetch(
        "/api/prototype/implementation-runtime/continue-quick-run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            mode: "recover_missing_server_continuation",
          }),
        },
      );
      const json = (await res.json()) as {
        success?: boolean;
        orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
        outcome?: string;
        reason?: string;
      };
      if (json.orchestrationPatch) {
        applyImplementationOrchestrationResult({
          messages: executionSingleChat.chatMessages,
          orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch),
        });
      }
      if (json.outcome === "dispatched") {
        showImplementationToast("서버에서 다음 CodeTask Cursor 실행을 복구했습니다.");
      } else if (json.reason) {
        showImplementationToast(
          `다음 CodeTask 실행 복구: ${formatQuickRunContinuationReason(json.reason)}`,
        );
      }
    } catch {
      // recovery is best-effort
    }
  }, [
    projectId,
    orchestrationAwareRequirementsState.promptTimeline,
    orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    implementationRuntimeDbBundle,
    applyImplementationOrchestrationResult,
    executionSingleChat.chatMessages,
    showImplementationToast,
  ]);

  useEffect(() => {
    if (orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.status !== "passed") {
      return;
    }
    const timer = window.setTimeout(() => {
      void recoverServerQuickRunContinuationIfNeeded();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [
    orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.status,
    orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.sourceCommitSha,
    recoverServerQuickRunContinuationIfNeeded,
  ]);

  const dispatchNextQuickRunFromGithubVerify = useCallback(
    (next: QuickRunGithubAdvanceDispatch) => {
      pendingQuickRunQueueDispatchRef.current = {
        codeTaskId: next.codeTaskId,
        parentTaskId: next.parentTaskId,
        workItemId: next.workItemId,
      };
      codeTaskDispatchPreferredTaskIdRef.current = next.parentTaskId;
      showImplementationToast(`다음 CodeTask(${next.codeTaskId}) Cursor 실행을 시작합니다.`);
      runImplementationStageActionRef.current("REQUEST_TASK_CURSOR_EXECUTION");
    },
    [showImplementationToast],
  );

  const recoverQuickRunStuckGithubVerify = useCallback(async (options?: { readonly force?: boolean }) => {
    const pid = projectId.trim();
    if (!pid) return false;
    const state = parseRequirementsStateJson(requirementsStateJsonRef.current);
    return runQuickRunStuckGithubVerifyRecovery({
      projectId: pid,
      state,
      effectiveQueue: effectiveCodeTaskExecutionQueueV1,
      dbBundle: implementationRuntimeDbBundle,
      stuckVerifyDedupeRef: quickRunStuckGithubVerifyRef,
      continuationTriggerRef: quickRunCodeTaskContinuationRef,
      enrichPatch: enrichCodeTaskRunOrchestrationPatch,
      applyOrchestrationPatch: (patch) => {
        applyImplementationOrchestrationResult({
          messages: executionSingleChat.chatMessages,
          orchestrationPatch: patch,
        });
      },
      onNextQuickRunDispatch: dispatchNextQuickRunFromGithubVerify,
      showToast,
      onFailureNotice: (message) => appendImplementationExecutionNotice(message),
      refreshRuntime: async () => {
        const fetched = await fetchImplementationRuntime(pid);
        if (fetched.success) applyImplementationRuntimeFetch(fetched);
      },
      force: options?.force === true,
    });
  }, [
    projectId,
    effectiveCodeTaskExecutionQueueV1,
    implementationRuntimeDbBundle,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationOrchestrationResult,
    executionSingleChat.chatMessages,
    appendAiNoticeForImplementation,
    dispatchNextQuickRunFromGithubVerify,
    showToast,
    applyImplementationRuntimeFetch,
  ]);

  const handleManualGithubVerifyRetry = useCallback(async () => {
    quickRunStuckGithubVerifyRef.current = null;
    const ran = await recoverQuickRunStuckGithubVerify({ force: true });
    await loadImplementationRuntimeDb({ recover: true });
    if (!ran) {
      runImplementationStageActionRef.current("VERIFY_TASK_CURSOR_GITHUB");
    }
  }, [recoverQuickRunStuckGithubVerify, loadImplementationRuntimeDb]);

  const handleRetryFailedCodeTask = useCallback(
    async (codeTaskId: string) => {
      const pid = projectId.trim();
      if (!pid || !codeTaskId.trim()) return;
      const res = await credentialsIncludeFetch(
        "/api/prototype/implementation-runtime/retry-failed-task",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid, codeTaskId: codeTaskId.trim() }),
        },
      );
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!json.success) {
        window.alert(json.message ?? "실패 작업 재실행을 준비하지 못했습니다.");
        return;
      }
      await loadImplementationRuntimeDb({ recover: true });
    },
    [projectId, loadImplementationRuntimeDb],
  );

  useEffect(() => {
    void recoverQuickRunStuckGithubVerify();
  }, [
    recoverQuickRunStuckGithubVerify,
    orchestrationAwareRequirementsState.implementationQuickRunV1?.status,
    orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
    effectiveCodeTaskExecutionQueueV1?.status,
    effectiveCodeTaskExecutionQueueV1?.currentIndex,
  ]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const quickRun = parseImplementationQuickRunV1(
      orchestrationAwareRequirementsState.implementationQuickRunV1,
    );
    if (quickRun?.status !== "running") return;
    const cursor = parseTaskCursorExecutionV1(
      orchestrationAwareRequirementsState.taskCursorExecutionV1,
    );
    if (!cursor || !isInFlightTaskCursorExecution(cursor)) return;

    const tick = () => {
      quickRunStuckGithubVerifyRef.current = null;
      void recoverQuickRunStuckGithubVerify();
      void loadImplementationRuntimeDb({ recover: true });
    };
    const interval = window.setInterval(tick, 10_000);
    return () => window.clearInterval(interval);
  }, [
    projectId,
    recoverQuickRunStuckGithubVerify,
    loadImplementationRuntimeDb,
    orchestrationAwareRequirementsState.implementationQuickRunV1?.status,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    effectiveCodeTaskExecutionQueueV1?.status,
  ]);

  const implementationCursorGate = useMemo(
    () =>
      buildImplementationCursorGateContext(
        {
          ...parsedRequirementsState,
          implementationTaskPlanV1: effectiveImplementationState.implementationTaskPlanV1,
        },
        {
          envOk: effectiveImplementationState.envOk,
          designOk: effectiveImplementationState.designOk,
        },
        { projectId: projectId.trim() || undefined },
      ),
    [parsedRequirementsState, effectiveImplementationState, projectId],
  );

  const confirmImplementationTaskPlan = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: pid,
      requirementsStateJson,
      projectArtifacts: executionArtifacts.projectArtifacts,
      artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
      featureDraftTitles: featureDraftTitles ?? [],
      implementationWorkPlanDraftV1: effectiveImplementationState.implementationWorkPlanDraftV1,
      envOk: effectiveImplementationState.envOk,
      designOk: effectiveImplementationState.designOk,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_confirmed") {
      const message = "이미 구현 작업안이 확정되었습니다.";
      showToast(message);
      return { outcome: "no_op", message };
    }
    applyImplementationOrchestrationResult({
      messages: result.chatPatch.messages,
      orchestrationPatch: result.orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    projectId,
    requirementsStateJson,
    executionArtifacts,
    featureDraftTitles,
    effectiveImplementationState,
    parsedRequirementsState.promptTimeline,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateImplementationWorkPlanDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson,
      projectId: pid,
      projectArtifacts: executionArtifacts.projectArtifacts,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
      implementationSeedV1: parsedRequirementsState.implementationSeedV1,
      envOk: canRequestGeneration.envOk,
      designOk: canRequestGeneration.designOk,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_exists") {
      const message = "이미 구현 작업안 초안이 생성되었습니다.";
      showToast(message);
      return { outcome: "no_op", message };
    }
    const orchestrationPatch = {
      ...result.orchestrationPatch,
      promptTimeline: appendCreateWorkPlanBootstrapCtaRouteTimeline({
        promptTimeline: result.orchestrationPatch.promptTimeline ?? parsedRequirementsState.promptTimeline,
      }),
    };
    applyImplementationOrchestrationResult({
      messages: result.messages,
      orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    projectId,
    requirementsStateJson,
    executionArtifacts.projectArtifacts,
    canRequestGeneration.envOk,
    canRequestGeneration.designOk,
    parsedRequirementsState.promptTimeline,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.implementationSeedV1,
    planningSlotDefinitions,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const appendStatusQueryFromChip = useCallback(
    (intent: ImplementationStatusQueryIntent) => {
      const result = buildStatusQueryOperationalResult(intent);
      if (!result) {
        showToast("환경 점검 결과를 표시할 수 없습니다. [환경 점검 결과]를 다시 선택해 주세요.");
        return;
      }
      if (result === "handled" || result === "continue") return;
      if (result.kind !== "status_query") return;
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const nextMessages = [...(resolved.messages ?? []), result.aiMessage];
      executionSingleChat.applyPersistedMessages(nextMessages);
      let timeline = parsedRequirementsState.promptTimeline;
      for (const entry of result.timelineEntries ?? []) {
        timeline = appendPromptTimeline(timeline, entry);
      }
      void persistChatToDb(
        {
          messages: nextMessages,
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        { promptTimeline: timeline },
      );
    },
    [
      buildStatusQueryOperationalResult,
      executionSingleChat,
      requirementsStateJson,
      parsedRequirementsState.promptTimeline,
      persistChatToDb,
      showToast,
    ],
  );

  const showRoleCheckDetails = useCallback(() => {
    appendStatusQueryFromChip("role_check_details");
  }, [appendStatusQueryFromChip]);

  const appendImplementationTaskListAiMessage = useCallback(
    (message: RequirementsMessage) => {
      if (boardPanelVisibleRef.current) {
        const pid = projectId.trim();
        if (
          pid &&
          resolveIntegratedAppPreviewReadyFromOrchestration({
            projectId: pid,
            orchestration: orchestrationAwareRequirementsStateRef.current,
          })
        ) {
          return;
        }
        const text = String(message.content ?? "").trim();
        const suggestions = (message.meta as { interviewSuggestions?: readonly string[] } | undefined)
          ?.interviewSuggestions;
        const actionLabels = suggestions?.filter((l) => String(l ?? "").trim());
        if (text || actionLabels?.length) {
          setImplementationStageNoticeModal({
            body: text,
            ...(actionLabels?.length ? { actionLabels: [...actionLabels] } : {}),
          });
        }
        return;
      }
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      const nextMessages = [...(resolved.messages ?? []), message];
      executionSingleChat.applyPersistedMessages(nextMessages);
      void persistChatToDb({
        messages: nextMessages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      });
    },
    [requirementsStateJson, executionSingleChat, persistChatToDb, projectId],
  );

  const refreshImplementationBoardWithExecutionSetup = useCallback(
    (setup: ExecutionSetupSourceGenerationRow | null, source = "board_refresh") => {
      const pid = projectId.trim();
      const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
      if (!pid || !taskList || !setup) return;

      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: orchestrationAwareRequirementsState,
      });
      if (!board) return;

      // State-based board panel is the source of truth — env/setup refresh must not rewrite chat messages.
      executionSetupBoardSyncedKeyRef.current = buildImplementationBoardRefreshSyncKey({
        setup,
        previewContent: "",
        taskCount: taskList.tasks.length,
        codeAgentWipStatus: orchestrationAwareRequirementsState.codeAgentWipExecutionV1?.status ?? null,
      });
    },
    [projectId, orchestrationAwareRequirementsState],
  );

  refreshImplementationBoardRef.current = refreshImplementationBoardWithExecutionSetup;

  useEffect(() => {
    if (!executionSetupRow) return;
    refreshImplementationBoardRef.current?.(executionSetupRow, "execution_setup_loaded");
  }, [executionSetupRow, orchestrationAwareRequirementsState.implementationTaskListV1]);

  const handleExecutionSetupChanged = useCallback(async () => {
    executionSetupBoardSyncedKeyRef.current = null;
    const row = await refreshExecutionEnvironmentStatus();
    if (!row) {
      showToast("환경설정을 다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    refreshImplementationBoardWithExecutionSetup(row, "execution_setup_saved");
  }, [refreshExecutionEnvironmentStatus, refreshImplementationBoardWithExecutionSetup, showToast]);

  const applyDbStrategyResult = useCallback(
    (
      result:
        | ReturnType<typeof buildDbIntegrationReviewResult>
        | ReturnType<typeof buildDataModelDraftResult>
        | ReturnType<typeof buildMockImplementationModeResult>,
    ): ImplementationStageActionRunResult => {
      if (result.kind === "blocked") {
        showToast(result.message);
        return { outcome: "blocked", message: result.message };
      }
      applyImplementationOrchestrationResult({
        messages: result.messages,
        orchestrationPatch: result.orchestrationPatch,
      });
      return { outcome: "executed" };
    },
    [applyImplementationOrchestrationResult, showToast],
  );

  const reviewDbIntegrationNeed = useCallback((): ImplementationStageActionRunResult => {
    let slots = parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const ensured = ensureImplementationTaskPlan({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        ensureDraftInput: {
          requirementsStateJson,
          projectId: projectId.trim(),
          projectArtifacts: executionArtifacts.projectArtifacts,
          orchestration: parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: planningSlotDefinitions,
          envOk: canRequestGeneration.envOk,
          promptTimeline: parsedRequirementsState.promptTimeline,
        },
        confirmTaskPlanInput: {
          projectId: projectId.trim(),
          requirementsStateJson,
          projectArtifacts: executionArtifacts.projectArtifacts,
          artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
          featureDraftTitles: parsedRequirementsState.featureDraftTitles,
          envOk: canRequestGeneration.envOk,
          designOk: true,
          promptTimeline: parsedRequirementsState.promptTimeline,
        },
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildDbIntegrationReviewResult({
        requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        implementationTaskPlanV1: effectiveImplementationState.implementationTaskPlanV1,
        projectArtifacts: executionArtifacts.projectArtifacts,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    projectId,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    effectiveImplementationState.implementationTaskPlanV1,
    effectiveImplementationState,
    parsedRequirementsState.promptTimeline,
    executionArtifacts.projectArtifacts,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.artifactOrchestrationV1,
    parsedRequirementsState.featureDraftTitles,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateDataModelDraft = useCallback((): ImplementationStageActionRunResult => {
    return applyDbStrategyResult(
      buildDataModelDraftResult({
        requirementsStateJson,
        implementationSlotsV1: parsedRequirementsState.implementationSlotsV1,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    parsedRequirementsState.promptTimeline,
  ]);

  const confirmMockImplementationMode = useCallback((): ImplementationStageActionRunResult => {
    let slots = parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const taskListEnsured = ensureImplementationArtifactsFromTaskList({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        projectId: projectId.trim(),
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
        envOk: canRequestGeneration.envOk,
        designOk: true,
        envCursorBadge: canRequestGeneration.envOk ? "ok" : "needs",
        promptTimeline: parsedRequirementsState.promptTimeline,
      });
      if (taskListEnsured.ok && taskListEnsured.patch) {
        const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        applyImplementationOrchestrationResult({
          messages: taskListEnsured.messages ?? (current.messages ?? []),
          orchestrationPatch: taskListEnsured.patch,
        });
        slots = taskListEnsured.patch.implementationSlotsV1 as typeof slots;
      }
    }
    if (!slots) {
      const ensured = ensureMockImplementationReady({
        requirementsStateJson,
        effectiveState: effectiveImplementationState,
        ensureTaskPlanInput: {
          requirementsStateJson,
          effectiveState: effectiveImplementationState,
          ensureDraftInput: {
            requirementsStateJson,
            projectId: projectId.trim(),
            projectArtifacts: executionArtifacts.projectArtifacts,
            orchestration: parsedRequirementsState.singleChatOrchestrationV1,
            slotDefinitions: planningSlotDefinitions,
            envOk: canRequestGeneration.envOk,
            promptTimeline: parsedRequirementsState.promptTimeline,
          },
          confirmTaskPlanInput: {
            projectId: projectId.trim(),
            requirementsStateJson,
            projectArtifacts: executionArtifacts.projectArtifacts,
            artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
            featureDraftTitles: parsedRequirementsState.featureDraftTitles,
            envOk: canRequestGeneration.envOk,
            designOk: true,
            promptTimeline: parsedRequirementsState.promptTimeline,
          },
        },
        promptTimeline: parsedRequirementsState.promptTimeline,
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
      applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildMockImplementationModeResult({
        requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    requirementsStateJson,
    projectId,
    parsedRequirementsState.implementationSlotsV1,
    parsedRequirementsState.implementationDbStrategyV1,
    parsedRequirementsState.promptTimeline,
    effectiveImplementationState,
    executionArtifacts.projectArtifacts,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.artifactOrchestrationV1,
    parsedRequirementsState.featureDraftTitles,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const applyPlatformScmExecutorJson = useCallback(
    async (input: {
      readonly wip: CodeAgentWipExecutionV1;
      readonly finalizeIntegratedFinalScm?: boolean;
      readonly taskRowsCompleted?: boolean;
    }) => {
      const refState = parseRequirementsStateJson(requirementsStateJsonRef.current);
      return fetchPlatformScmExecutePersistPatch({
        projectId,
        wip: input.wip,
        requirementsStateJson: requirementsStateJsonRef.current,
        promptTimeline: refState.promptTimeline ?? [],
        executionState: refState.implementationTaskExecutionStateV1,
        integratedExecutionState: refState.implementationIntegratedExecutionStateV1,
        taskRowsCompleted: input.taskRowsCompleted,
        finalizeIntegratedFinalScm: input.finalizeIntegratedFinalScm,
      });
    },
    [projectId],
  );

  const applyPlatformScmMergeExecutorJson = useCallback(
    async (input: {
      readonly wip: CodeAgentWipExecutionV1;
      readonly autoMergeOnly?: boolean;
    }) => {
      const refState = parseRequirementsStateJson(requirementsStateJsonRef.current);
      return fetchPlatformScmMergePersistPatch({
        projectId,
        wip: input.wip,
        requirementsStateJson: requirementsStateJsonRef.current,
        promptTimeline: refState.promptTimeline ?? [],
        executionState: refState.implementationTaskExecutionStateV1,
        qualityGateResults: refState.implementationQualityGateResultsV1,
        autoMergeOnly: input.autoMergeOnly,
      });
    },
    [projectId],
  );

  const persistPlatformScmOrchestrationPatch = useCallback(
    (persistPatch: PlatformScmExecutePersistPatch) => {
      const patch = buildPlatformScmOrchestrationPatchFromPersist(persistPatch);
      if (!patch) return;
      applyImplementationOrchestrationResult({
        messages:
          persistPatch.orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
        orchestrationPatch: {
          ...patch.orchestrationPatch,
          ...(patch.executionState
            ? { implementationTaskExecutionStateV1: patch.executionState }
            : {}),
          ...(patch.integratedExecutionState
            ? { implementationIntegratedExecutionStateV1: patch.integratedExecutionState }
            : {}),
        },
      });
    },
    [applyImplementationOrchestrationResult, executionSingleChat.chatMessages],
  );

  const persistPlatformScmMergePatch = useCallback(
    (persistPatch: PlatformScmMergePersistPatch) => {
      const patch = buildPlatformScmOrchestrationPatchFromPersist(persistPatch);
      if (!patch) return;
      applyImplementationOrchestrationResult({
        messages:
          persistPatch.orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
        orchestrationPatch: {
          ...patch.orchestrationPatch,
          ...(patch.executionState
            ? { implementationTaskExecutionStateV1: patch.executionState }
            : {}),
        },
      });
    },
    [applyImplementationOrchestrationResult, executionSingleChat.chatMessages],
  );

  const tryAutoPlatformScmMergeAfterPush = useCallback(
    async (wip: CodeAgentWipExecutionV1) => {
      if (!shouldAttemptAutoPlatformScmMerge(wip)) return;
      try {
        const mergePatch = await applyPlatformScmMergeExecutorJson({ wip, autoMergeOnly: true });
        persistPlatformScmMergePatch(mergePatch);
        if (mergePatch.orchestration.message) {
          showToast(mergePatch.orchestration.message);
        }
      } catch {
        // auto-merge is best-effort after push/PR
      }
    },
    [applyPlatformScmMergeExecutorJson, persistPlatformScmMergePatch, showToast],
  );

  const executePlatformScmAfterRequest = useCallback(
    (wip: CodeAgentWipExecutionV1) => {
      void (async () => {
        showToast("플랫폼 SCM push/PR 실행을 시작합니다...");
        try {
          const persistPatch = await applyPlatformScmExecutorJson({ wip });
          persistPlatformScmOrchestrationPatch(persistPatch);
          showToast(persistPatch.orchestration.message);
          const updatedWip =
            persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? wip;
          if (persistPatch.orchestration.kind === "completed") {
            await tryAutoPlatformScmMergeAfterPush(updatedWip);
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error));
        }
      })();
    },
    [applyPlatformScmExecutorJson, persistPlatformScmOrchestrationPatch, tryAutoPlatformScmMergeAfterPush, showToast],
  );

  const wipChipHandlers = useMemo(
    () =>
      buildWipChipHandlerSlice({
        projectId,
        requirementsStateJson,
        baseRequirementsState: parsedRequirementsState,
        pendingPatch: pendingImplementationPatch,
        parsedState: orchestrationAwareRequirementsState,
        envOk: effectiveImplementationState.envOk,
        designOk: effectiveImplementationState.designOk,
        cursorApiConfigured: evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready,
        applyMessages: executionSingleChat.applyPersistedMessages,
        appendNotice: (text) => appendAiNoticeForImplementation(text),
        persistOrchestration: (chat, orch) => {
          if (chat && orch) {
            applyImplementationOrchestrationResult({
              messages: chat.messages,
              orchestrationPatch: orch,
            });
            return;
          }
          applyPendingFromOrchestrationPatch(orch);
          void persistChatToDb(chat, orch);
        },
        focusComposer: () => queueMicrotask(() => chatInputRef.current?.focus()),
        showToast,
        onAfterScmCommitRequested: executePlatformScmAfterRequest,
        canApplyGit,
      }),
    [
      projectId,
      requirementsStateJson,
      parsedRequirementsState,
      pendingImplementationPatch,
      orchestrationAwareRequirementsState,
      effectiveImplementationState.envOk,
      effectiveImplementationState.designOk,
      executionSetupRow,
      executionSingleChat,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      applyImplementationOrchestrationResult,
      showToast,
      executePlatformScmAfterRequest,
      canApplyGit,
    ],
  );

  const persistStageActionTimelineEntries = useCallback(
    (
      entries: readonly RequirementsPromptTimelineEntry[],
      runLogPatch?: { readonly implementationStageActionRunLogV1: unknown },
    ) => {
      if (!entries.length && !runLogPatch) return;
      const imp = resolveOrchestrationAwareRequirementsState({
        base: parseRequirementsStateJson(requirementsStateJsonRef.current),
        pendingPatch: pendingImplementationPatchRef.current,
      });
      let timeline = imp.promptTimeline;
      for (const entry of entries) {
        timeline = appendPromptTimeline(timeline, entry);
      }
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline: timeline });
      const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJsonRef.current);
      void persistChatToDb(
        {
          messages: resolved.messages ?? [],
          slots: resolved.slots ?? [],
          answers: resolved.answers ?? {},
          currentSlotKey: resolved.currentSlotKey ?? null,
        },
        { promptTimeline: timeline, ...(runLogPatch ?? {}) },
        undefined,
        { force: true },
      );
    },
    [persistChatToDb],
  );

  const persistImplementationStageActionRun = useCallback(
    (run: ImplementationStageActionRun) => {
      const refState = parseRequirementsStateJson(requirementsStateJsonRef.current);
      const runLogPatch = buildImplementationStageActionRunLogPatch({
        currentLog: refState.implementationStageActionRunLogV1,
        run,
      });
      let extraEntries = [...run.timelineEntries];
      if (run.actionId === "REQUEST_CODE_AGENT_WIP") {
        const pid = projectId.trim();
        if (run.runResult?.outcome === "executed") {
          const wip = refState.codeAgentWipExecutionV1;
          const hasDraftWip =
            wip &&
            (wip.bridgeExecutionStatus === "draft_created" ||
              wip.executionStatus === "draft_created" ||
              wip.commits.some((commit) => String(commit.sha ?? "").startsWith("wip-stub")));
          if (hasDraftWip && wip) {
            extraEntries = [
              ...extraEntries,
              buildCodeAgentWipDraftCreatedTimelineEntry({
                projectId: pid,
                wip,
                runId: run.runId,
                source: "REQUEST_CODE_AGENT_WIP",
              }),
            ];
          }
        } else if (run.runResult?.outcome === "blocked") {
          extraEntries = [
            ...extraEntries,
            buildCodeAgentWipDraftFailedTimelineEntry({
              projectId: pid,
              runId: run.runId,
              reason: mapBlockedMessageToWipDraftFailureReason(run.runResult.message),
              detail: run.runResult.message,
              source: "REQUEST_CODE_AGENT_WIP",
            }),
          ];
        }
      }
      persistStageActionTimelineEntries(extraEntries, runLogPatch);
    },
    [persistStageActionTimelineEntries, projectId],
  );

  const applyImplementationStageActionExecutionResult = useCallback(
    (result: ImplementationStageActionExecutionResult) => {
      if (result.timelineEntries?.length) {
        persistStageActionTimelineEntries(result.timelineEntries);
      }
      switch (result.kind) {
        case "blocked":
          showToast(result.message);
          break;
        case "focus_composer":
          showToast(result.message);
          queueMicrotask(() => chatInputRef.current?.focus());
          break;
        case "open_env_settings":
          setExecutionEnvironmentModalOpen(true);
          break;
        case "open_artifacts":
          setArtifactHubOpen(true);
          break;
        case "show_status":
          if (result.intent === "role") showRoleCheckDetails();
          else if (result.intent === "scm") appendStatusQueryFromChip("scm_check_details");
          else appendStatusQueryFromChip("environment_check_details");
          break;
        case "handled":
          break;
      }
    },
    [showToast, showRoleCheckDetails, appendStatusQueryFromChip, persistStageActionTimelineEntries],
  );

  const showImplementationSeedReadinessCheck = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const result = buildPlanningImplementationSeedCheckResult({
      projectId: pid,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      definitions: planningSlotDefinitions,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    const nextMessages = [...(resolved.messages ?? []), result.message];
    applyImplementationOrchestrationResult({
      messages: nextMessages,
      orchestrationPatch: result.orchestrationPatch,
    });
  }, [
    projectId,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.promptTimeline,
    planningSlotDefinitions,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
  ]);

  const runImplementationQualityGate = useCallback(
    (role: "reviewer" | "security"): ImplementationStageActionRunResult => {
      const orchestration = orchestrationAwareRequirementsState;
      const taskList = orchestration.implementationTaskListV1;
      const pid = projectId.trim();
      if (!taskList || !pid) {
        const message = "구현 작업목록이 없어 점검을 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const taskCursor = orchestration.taskCursorExecutionV1;
      let executionState = orchestration.implementationTaskExecutionStateV1;
      if (
        taskCursor &&
        shouldSyncExecutionStateAfterTaskCursorGithubVerify(taskCursor.status) &&
        executionState
      ) {
        executionState = syncTaskExecutionStateAfterGithubVerified({
          executionState,
          taskId: taskCursor.taskId,
          cursorWorkItems: orchestration.cursorWorkItemsV1 ?? [],
        });
      }

      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: {
          ...orchestration,
          ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
        },
      });
      if (!board) {
        const message = "구현 작업 보드를 만들 수 없어 점검을 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const pickedTargetTaskIds = pickQualityGateTargetTaskIds({
        role,
        board,
        taskCursorTaskId:
          taskCursor && shouldSyncExecutionStateAfterTaskCursorGithubVerify(taskCursor.status)
            ? taskCursor.taskId
            : null,
      });
      const targetTaskIds = pickedTargetTaskIds.length ? pickedTargetTaskIds : undefined;
      const bridgeTarget =
        buildQualityGateBridgeTargetFromTaskCursor(taskCursor) ??
        buildQualityGateBridgeTargetFromWip(orchestration.codeAgentWipExecutionV1);

      const outcome = executeImplementationQualityGateCheck({
        role,
        taskList,
        executionState,
        qualityGateResults: orchestration.implementationQualityGateResultsV1,
        projectId: pid,
        targetTaskIds,
        bridgeTarget,
      });
      if ("blocked" in outcome) {
        showToast(outcome.blocked);
        return { outcome: "blocked", message: outcome.blocked };
      }
      const qgTimeline =
        outcome.qualityGateResult.engineConnectionStatus === "pending_engine_connection"
          ? buildTargetRepoE2eTimelineEntry({
              action: "review_security_diff_engine_pending",
              projectId: pid,
              selectedTaskId: bridgeTarget?.selectedTaskId,
              repoFullName: bridgeTarget?.targetRepository,
              branchName: bridgeTarget?.branchName,
              commitSha: bridgeTarget?.commitSha,
              changedFilesCount: bridgeTarget?.changedFiles?.length,
              status: "pending_engine_connection",
            })
          : null;
      void persistChatToDb(undefined, {
        implementationTaskExecutionStateV1: outcome.executionState,
        implementationQualityGateResultsV1: outcome.qualityGateResults,
        ...(qgTimeline
          ? {
              promptTimeline: [...(orchestration.promptTimeline ?? []), qgTimeline],
            }
          : {}),
      });
      appendAiNoticeForImplementation(outcome.aiMessageContent);
      return { outcome: "executed" };
    },
    [orchestrationAwareRequirementsState, projectId, persistChatToDb, executionSingleChat, showToast],
  );

  const runFinalScmIntegratedStageStep = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) {
      const message = "프로젝트를 선택해 주세요.";
      showToast(message);
      return { outcome: "blocked", message };
    }

    const resolvedWip = resolveCodeAgentWipForFinalScmIntegratedStage({
      projectId: pid,
      existingWip: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      previewScope: parsedRequirementsState.implementationPreviewScopeV1 ?? null,
      codeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1 ?? null,
      taskList: parsedRequirementsState.implementationTaskListV1 ?? null,
      codeTaskRuns: parseCodeTaskExecutionRunsV1(
        parsedRequirementsState.codeTaskExecutionRunsV1,
      ),
      taskCursorExecution: parsedRequirementsState.taskCursorExecutionV1 ?? null,
      taskCursorExecutionHistory:
        parsedRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      autoQualityGate: parsedRequirementsState.implementationAutoQualityGateV1 ?? null,
      executionSetup: executionSetupRow,
    });
    if (!resolvedWip.ok) {
      showToast(resolvedWip.message);
      return { outcome: "blocked", message: resolvedWip.message };
    }
    const wip = resolvedWip.wip;
    if (resolvedWip.synthesized) {
      applyImplementationOrchestrationResult({
        orchestrationPatch: { codeAgentWipExecutionV1: wip },
      });
      void persistChatToDb(undefined, { codeAgentWipExecutionV1: wip });
    }
    const readiness = validateFinalScmIntegratedStageReadiness(wip);
    if (!readiness.ok) {
      showToast(readiness.message);
      return { outcome: "blocked", message: readiness.message };
    }

    const taskList = parsedRequirementsState.implementationTaskListV1;
    if (!taskList) {
      const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
      showToast(message);
      return { outcome: "blocked", message };
    }

    const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
      projectId: pid,
      orchestration: parsedRequirementsState,
    });
    if (!boardBefore) {
      const message = "구현 실행 보드를 만들 수 없습니다.";
      showToast(message);
      return { outcome: "blocked", message };
    }
    const allTasksComplete = boardBefore.taskRows.every((row) => row.currentRole === "completed");

    if (isFinalScmPlatformExecutionCompleted(wip)) {
      const prior = parsedRequirementsState.implementationIntegratedExecutionStateV1;
      const done = finalizeIntegratedStageStep({
        state: prior,
        projectId: pid,
        step: "final_scm",
        taskRowsCompleted: allTasksComplete,
      });
      void persistChatToDb(undefined, {
        implementationIntegratedExecutionStateV1: done,
      });
      const actionNotice = buildIntegratedStageStepActionNotice({ step: "final_scm", integratedState: done });
      appendAiNoticeForImplementation(actionNotice);
      const nowIso = new Date().toISOString();
      const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
        integratedExecutionState: done,
      })!;
      appendImplementationTaskListAiMessage(
        buildImplementationExecutionBoardMessage({
          board: nextBoard,
          nowIso,
          previewReady: prototypeRunSyncSnapshot.previewReady,
          codeAgentWipExecutionV1: wip,
          executionSetup: executionSetupRow,
        }),
      );
      return { outcome: "executed" };
    }

    const preparedWip = prepareCodeAgentWipForFinalScmIntegratedStage({ wip: wip! });
    const inProgressIntegrated = markIntegratedStepInProgress({
      state: parsedRequirementsState.implementationIntegratedExecutionStateV1,
      projectId: pid,
      step: "final_scm",
      resultSummary: "플랫폼 SCM push/PR 실행 중",
    });

    applyImplementationOrchestrationResult({
      orchestrationPatch: {
        codeAgentWipExecutionV1: preparedWip,
        implementationIntegratedExecutionStateV1: inProgressIntegrated,
      },
    });

    showToast("최종 SCM 반영 실행을 시작합니다...");
    appendAiNoticeForImplementation(buildFinalScmIntegratedStageStartedNotice());

    void (async () => {
      try {
        const persistPatch = await applyPlatformScmExecutorJson({
          wip: preparedWip,
          finalizeIntegratedFinalScm: true,
          taskRowsCompleted: allTasksComplete,
        });
        const notice =
          persistPatch.orchestration.kind === "completed"
            ? buildFinalScmIntegratedStageCompletedNotice({
                message: persistPatch.orchestration.message,
                scm:
                  persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1
                    ?.platformScmExecutionV1,
              })
            : buildFinalScmIntegratedStageFailedNotice(persistPatch.orchestration.message);

        if (persistPatch.orchestration.orchestrationPatch) {
          applyImplementationOrchestrationResult({
            messages:
              persistPatch.orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
            orchestrationPatch: {
              ...persistPatch.orchestration.orchestrationPatch,
              ...(persistPatch.executionState
                ? { implementationTaskExecutionStateV1: persistPatch.executionState }
                : {}),
              ...(persistPatch.integratedExecutionState
                ? { implementationIntegratedExecutionStateV1: persistPatch.integratedExecutionState }
                : {}),
            },
          });
        }

        appendAiNoticeForImplementation(notice);

        if (persistPatch.orchestration.kind === "completed") {
          const updatedWip =
            persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? preparedWip;
          await tryAutoPlatformScmMergeAfterPush(updatedWip);
        }

        const nowIso = new Date().toISOString();
        const refState = parseRequirementsStateJson(requirementsStateJsonRef.current);
        const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
          projectId: pid,
          orchestration: refState,
          integratedExecutionState: persistPatch.integratedExecutionState,
        })!;
        appendImplementationTaskListAiMessage(
          buildImplementationExecutionBoardMessage({
            board: nextBoard,
            nowIso,
            previewReady: prototypeRunSyncSnapshot.previewReady,
            codeAgentWipExecutionV1:
              persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ??
              preparedWip,
            executionSetup: executionSetupRow,
          }),
        );
        showToast(persistPatch.orchestration.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(message);
        appendAiNoticeForImplementation(buildFinalScmIntegratedStageFailedNotice(message));
      }
    })();

    return { outcome: "executed" };
  }, [
    projectId,
    orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    parsedRequirementsState,
    showToast,
    applyImplementationOrchestrationResult,
    executionSingleChat,
    applyPlatformScmExecutorJson,
    tryAutoPlatformScmMergeAfterPush,
    appendImplementationTaskListAiMessage,
    prototypeRunSyncSnapshot.previewReady,
    executionSetupRow,
    persistChatToDb,
  ]);

  const runPlatformScmMergeStep = useCallback((): ImplementationStageActionRunResult => {
    const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
    const readiness = validatePlatformScmMergeStepReadiness(wip);
    if (!readiness.ok) {
      showToast(readiness.message);
      return readiness.noOp
        ? { outcome: "no_op", message: readiness.message }
        : { outcome: "blocked", message: readiness.message };
    }

    showToast("플랫폼 SCM PR merge를 시작합니다...");
    void (async () => {
      try {
        const persistPatch = await applyPlatformScmMergeExecutorJson({ wip: wip!, autoMergeOnly: false });
        persistPlatformScmMergePatch(persistPatch);
        showToast(persistPatch.orchestration.message);
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error));
      }
    })();

    return { outcome: "executed" };
  }, [
    orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    showToast,
    applyPlatformScmMergeExecutorJson,
    persistPlatformScmMergePatch,
  ]);

  const runIntegratedStageStep = useCallback(
    (step: ImplementationIntegratedStep): ImplementationStageActionRunResult => {
      if (step === "final_scm") {
        return runFinalScmIntegratedStageStep();
      }
      const pid = projectId.trim();
      if (!pid) {
        const message = "프로젝트를 선택해 주세요.";
        showToast(message);
        return { outcome: "blocked", message };
      }
      const taskList = parsedRequirementsState.implementationTaskListV1;
      if (!taskList) {
        const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
        showToast(message);
        return { outcome: "blocked", message };
      }

      const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
      })!;
      const allTasksComplete = boardBefore.taskRows.every((row) => row.currentRole === "completed");

      let previewScopePatch: { implementationPreviewScopeV1: import("@/lib/prototype/implementationPreviewScopeV1").ImplementationPreviewScopeV1 } | null =
        null;
      if (step === "refactor_common") {
        const integration = integrateCompletedCodeTasksForPreview({
          codeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1 ?? null,
          taskList,
          codeTaskRuns: parseCodeTaskExecutionRunsV1(parsedRequirementsState.codeTaskExecutionRunsV1) ?? [],
          taskCursorExecution: parsedRequirementsState.taskCursorExecutionV1 ?? null,
          taskCursorExecutionHistory: parsedRequirementsState.taskCursorExecutionHistoryV1 ?? null,
          autoQualityGate: parsedRequirementsState.implementationAutoQualityGateV1 ?? null,
        });
        if (!integration.ok) {
          showToast(integration.message);
          return { outcome: "blocked", message: integration.message };
        }
        previewScopePatch = { implementationPreviewScopeV1: integration.previewScope };
      }

      const prior = parsedRequirementsState.implementationIntegratedExecutionStateV1;
      const done = finalizeIntegratedStageStep({
        state: prior,
        projectId: pid,
        step,
        taskRowsCompleted: previewScopePatch != null ? true : allTasksComplete,
      });
      void persistChatToDb(undefined, {
        implementationIntegratedExecutionStateV1: done,
        ...(previewScopePatch ?? {}),
      });

      const actionNotice = buildIntegratedStageStepActionNotice({ step, integratedState: done });
      const noticeLines = [actionNotice];
      if (previewScopePatch) {
        noticeLines.push(...buildIntegrationScopeDetailLines(previewScopePatch.implementationPreviewScopeV1));
      }
      appendAiNoticeForImplementation(noticeLines.join("\n"));

      const nowIso = new Date().toISOString();
      const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: parsedRequirementsState,
        integratedExecutionState: done,
      })!;
      appendImplementationTaskListAiMessage(
        buildImplementationExecutionBoardMessage({
          board: nextBoard,
          nowIso,
          previewReady: prototypeRunSyncSnapshot.previewReady,
          codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
          executionSetup: executionSetupRow,
        }),
      );

      return { outcome: "executed" };
    },
    [
      parsedRequirementsState,
      projectId,
      persistChatToDb,
      executionSingleChat,
      showToast,
      appendImplementationTaskListAiMessage,
      prototypeRunSyncSnapshot.previewReady,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      executionSetupRow,
    ],
  );

  const mergeIntegrationPullRequest = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) {
      showToast("프로젝트를 선택해 주세요.");
      return;
    }
    void (async () => {
      setIntegrationMergeBusy(true);
      try {
        const result = await mergeIntegrationPullRequestClient({ projectId: pid });
        if (result.ok) {
          showToast("통합 PR을 main에 반영했습니다.");
        } else {
          showToast(result.message ?? "main 반영에 실패했습니다.");
        }
      } catch (error) {
        showToast(toUserSafeIntegrationErrorMessage(error));
      } finally {
        setIntegrationMergeBusy(false);
      }
    })();
  }, [projectId, showToast]);

  const openImplementationPreview = useCallback(
    (input: { readonly mode: ImplementationPreviewEntryModeV1; readonly url: string }) => {
      void (async () => {
        const pid = projectId.trim();
        if (!pid || !input.url.trim()) return;

        if (input.mode === "integrated_app_preview") {
          const url = sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: input.url });
          if (!url) return;
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        if (input.mode !== "codetask_result_preview") return;

        const orchestration = orchestrationAwareRequirementsStateRef.current;
        const integratedReady = resolveIntegratedAppPreviewReadyFromOrchestration({
          projectId: pid,
          orchestration,
        });
        if (integratedReady) return;

        let openUrl = input.url.trim();
        if (
          shouldRunCompletedCodeTaskPreviewFallbackOnOpen({
            mode: input.mode,
            integratedAppPreviewReady: integratedReady,
            previewScopeV1: orchestration.implementationPreviewScopeV1,
            previewRuntimeV1: orchestration.implementationPreviewRuntimeV1,
          })
        ) {
          const integrationPlan = parseCodeTaskIntegrationPlanV1(
            orchestration.codeTaskIntegrationPlanV1,
          );
          const externalPreviewUrl =
            previewUrl ??
            (latestRun?.previewUrl && isLikelyPreviewUrl(latestRun.previewUrl)
              ? latestRun.previewUrl.trim()
              : null) ??
            (latestRun?.suggestedPreviewUrl && isLikelyPreviewUrl(latestRun.suggestedPreviewUrl)
              ? latestRun.suggestedPreviewUrl.trim()
              : null);

          const fallback = await ensureCompletedCodeTaskPreviewForFallback({
            projectId: pid,
            actionSource: "preview_button",
            orchestration,
            externalPreviewUrl,
            sourceIntegrationBranch: integrationPlan?.integrationBranch ?? null,
          });
          if (!fallback.ok) {
            showToast(fallback.message ?? "CodeTask Preview 준비에 실패했습니다.");
            return;
          }
          if (fallback.orchestrationPatch) {
            applyPendingFromOrchestrationPatch(fallback.orchestrationPatch);
            await persistChatToDb(undefined, fallback.orchestrationPatch, undefined, {
              awaitServer: false,
              force: true,
            });
          }
          openUrl = fallback.previewUrl?.trim() || buildCodeTaskPreviewFallbackUrl(pid);
        }

        window.open(openUrl, "_blank", "noopener,noreferrer");
      })();
    },
    [
      projectId,
      showToast,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      previewUrl,
      latestRun?.previewUrl,
      latestRun?.suggestedPreviewUrl,
    ],
  );

  const runIntegrationPipeline = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) {
      showToast("프로젝트를 선택해 주세요.");
      return;
    }
    if (!implementationBoard) {
      showToast("구현 작업 보드가 준비된 뒤 통합을 실행할 수 있습니다.");
      return;
    }
    if (implementationBoard.summary.blockingUserConfirmation > 0) {
      const canIntegrateFromCompleted = evaluateCodeTaskIntegration({
        codeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1 ?? null,
        taskList: parsedRequirementsState.implementationTaskListV1 ?? null,
        codeTaskRuns: parseCodeTaskExecutionRunsV1(parsedRequirementsState.codeTaskExecutionRunsV1) ?? [],
        taskCursorExecution: parsedRequirementsState.taskCursorExecutionV1 ?? null,
        taskCursorExecutionHistory: parsedRequirementsState.taskCursorExecutionHistoryV1 ?? null,
        autoQualityGate: parsedRequirementsState.implementationAutoQualityGateV1 ?? null,
      }).canIntegrate;
      if (!canIntegrateFromCompleted) {
        showToast("사용자 확인이 필요한 작업이 해소된 뒤 통합을 실행할 수 있습니다.");
        return;
      }
    }

    void (async () => {
      setIntegrationPipelineBusy(true);
      showToast(INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE);
      try {
        const pipelineResult = await runProjectIntegrationPrepareOnly({
          projectId: pid,
          projectName: projectName.trim() || null,
          implementationCodeTaskPlanV1: parsedRequirementsState.implementationCodeTaskPlanV1,
          implementationTaskListV1: parsedRequirementsState.implementationTaskListV1,
          codeTaskExecutionRunsV1: parsedRequirementsState.codeTaskExecutionRunsV1,
          implementationQuickRunV1: parsedRequirementsState.implementationQuickRunV1,
          createPullRequest: true,
        });

        if (pipelineResult.orchestrationPatch) {
          applyPendingFromOrchestrationPatch(pipelineResult.orchestrationPatch);
        }

        if (!pipelineResult.ok) {
          showToast(pipelineResult.message ?? "통합 및 Preview 준비에 실패했습니다.");
          if (pipelineResult.orchestrationPatch) {
            await persistChatToDb(undefined, pipelineResult.orchestrationPatch, undefined, {
              awaitServer: false,
              force: true,
            });
          }
          return;
        }

        let integrationServerSaved = true;
        if (pipelineResult.orchestrationPatch) {
          const saveResult = await persistChatToDb(
            undefined,
            pipelineResult.orchestrationPatch,
            undefined,
            { awaitServer: false, force: true },
          );
          if (saveResult?.serverSaved === false) {
            integrationServerSaved = false;
          }
        }

        const pipelineIntegratedReady =
          pipelineResult.previewReady === true ||
          String(pipelineResult.status ?? "").trim() === "integrated_app_preview_ready";

        setIntegrationPipelineClientResult({
          status: pipelineIntegratedReady ? "integrated_app_preview_ready" : pipelineResult.status,
          previewReady: pipelineIntegratedReady ? true : pipelineResult.previewReady,
          receivedAt: Date.now(),
        });

        const visibleContinueButton =
          Boolean(String(pipelineResult.nextRequiredStep ?? "").trim()) &&
          pipelineResult.previewReady !== true;

        const pipelineToast = resolveIntegrationPipelineUserToast({
          status: pipelineResult.status,
          previewReady: pipelineResult.previewReady,
          integratedAppPreviewReady: pipelineIntegratedReady,
          message: pipelineResult.message?.trim() || null,
          serverSaved: integrationServerSaved,
          nextRequiredStep: pipelineResult.nextRequiredStep,
          visibleContinueButton,
        });

        if (pipelineToast.reason === "suppressed_legacy_continue") {
          const suppressLog = buildImplementationExecutionLogTimelineEntry({
            action: "implementation_legacy_continue_toast_suppressed",
            orchestrationTraceGroup: "project_integration_pipeline",
            fields: {
              projectId: pid,
              status: pipelineResult.status ?? "",
              previewReady: pipelineResult.previewReady === true,
              integratedAppPreviewReady: pipelineIntegratedReady,
              rawMessage: pipelineResult.message ?? "",
            },
          });
          void persistChatToDb(undefined, {
            promptTimeline: appendPromptTimeline(
              parseRequirementsStateJson(requirementsStateJsonRef.current).promptTimeline ?? [],
              suppressLog,
            ),
          });
        }

        if (pipelineToast.show && pipelineToast.message) {
          showToast(pipelineToast.message);
        }
      } catch (error) {
        showToast(toUserSafeIntegrationErrorMessage(error));
      } finally {
        setIntegrationPipelineBusy(false);
      }
    })();
  }, [
    projectId,
    projectName,
    implementationBoard,
    parsedRequirementsState,
    persistChatToDb,
    applyPendingFromOrchestrationPatch,
    showToast,
  ]);

  const createImplementationSeedFromQuickDesignDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildCreateImplementationSeedFromQuickDesignDraftResult({
      projectId: pid,
      projectName: projectName || "프로젝트",
      fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
      promptTimeline: parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      showToast(result.message);
      return { outcome: "blocked", message: result.message };
    }
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    applyImplementationOrchestrationResult({
      messages: [...(resolved.messages ?? []), ...result.messages],
      orchestrationPatch: result.orchestrationPatch,
    });
    showToast("Quick Design 초안을 기준으로 구현 Seed를 생성했습니다.");
    return { outcome: "executed" };
  }, [
    projectId,
    projectName,
    parsedRequirementsState.fastPlanDraftV1,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.promptTimeline,
    planningSlotDefinitions,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const confirmQuickDesignForImplementation = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    void (async () => {
      setProtoBusy(true);
      showToast("Quick Design 확정 중입니다. LLM 설정이 켜져 있으면 1분 이상 걸릴 수 있습니다.");
      try {
        const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
        const { res, json } = await postQuickDesignConfirm(pid, {
          mode: "implementation",
          projectName: projectName || "프로젝트",
          projectDescription: projectDescription ?? "",
          requirementsStateJson,
          conversationMessages: resolved.messages ?? [],
          slotDefinitions: planningSlotDefinitions,
          envOkOverride: canRequestGeneration.envOk,
        });
        if (!res.ok || !json.success || !json.data) {
          showToast(json.message || "Quick Design 확정에 실패했습니다.");
          return;
        }
        applyImplementationOrchestrationResult({
          messages: json.data.messages ?? [],
          orchestrationPatch: (json.data.orchestrationPatch ?? {}) as PrototypeExecutionOrchestrationPersistInput,
        });
        showToast(json.data.userFacingSummary ?? json.message ?? "Quick Design을 확정했습니다.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Quick Design 확정 처리 중 오류가 발생했습니다.";
        showToast(msg);
      } finally {
        setProtoBusy(false);
      }
    })();
    return { outcome: "executed" };
  }, [
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    planningSlotDefinitions,
    canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    showToast,
  ]);

  const generateImplementationTaskList = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    const seed = parsedRequirementsState.implementationSeedV1;
    void (async () => {
      const { res, json } = await postImplementationPrepSync(pid, {
        seed,
        existingTaskList: parsedRequirementsState.implementationTaskListV1,
        existingCodeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1,
        existingExecutionState: parsedRequirementsState.implementationTaskExecutionStateV1,
        existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
        existingPreflightSummary: parsedRequirementsState.implementationWorkItemPreflightSummaryV1,
        existingQualityGate: parsedRequirementsState.implementationCodeTaskQualityGateV1,
        priorTimeline: parsedRequirementsState.promptTimeline,
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
        envOk: canRequestGeneration.envOk,
        designOk: effectiveImplementationState.designOk,
        previewReady: prototypeRunSyncSnapshot.previewReady,
      });
      const result = json.data;
      if (!res.ok || !json.success || !result?.ok) {
        showToast(json.message || result?.message || "구현 작업목록 생성에 실패했습니다.");
        return;
      }
      void persistChatToDb(
        resolvePrototypeExecutionSingleChatFromState(requirementsStateJson),
        result.patch,
      );
      for (const message of result.messages) {
        appendImplementationTaskListAiMessage(message);
      }
      showToast(
        result.userMessage ??
          (result.alreadyExisted
            ? "구현 준비 산출물이 이미 있습니다. 작업 보드를 표시합니다."
            : "구현 준비 산출물을 생성했습니다."),
      );
    })();
    return { outcome: "executed" };
  }, [
    projectId,
    parsedRequirementsState,
    executionArtifacts,
    canRequestGeneration,
    effectiveImplementationState.designOk,
    executionSetupRow,
    prototypeRunSyncSnapshot.previewReady,
    persistChatToDb,
    requirementsStateJson,
    appendImplementationTaskListAiMessage,
    showToast,
  ]);

  const runImplementationStageAction = useCallback(
    (actionId: ImplementationStageActionId): ImplementationStageActionRunResult => {
      switch (actionId) {
        case "GENERATE_IMPLEMENTATION_TASK_LIST":
          return generateImplementationTaskList();
        case "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION":
          return confirmQuickDesignForImplementation();
        case "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT":
          return createImplementationSeedFromQuickDesignDraft();
        case "START_IMPLEMENTATION_QUICK_RUN":
          void startImplementationQuickRunRef.current();
          return { outcome: "executed" };
        case "REDISPATCH_IMPLEMENTATION_RUNTIME": {
          const message =
            "재디스패치는 비활성화되었습니다. 선택 CodeTask 실행으로 DB Queue를 다시 시작하세요.";
          showToast(message);
          return { outcome: "blocked", message };
        }
        case "SHOW_IMPLEMENTATION_RUNTIME_DIAGNOSTICS": {
          void loadImplementationRuntimeDb({ recover: false });
          return { outcome: "executed" };
        }
        case "RELEASE_IMPLEMENTATION_EXECUTION_LOCK": {
          const message =
            "실행 잠금 해제는 비활성화되었습니다. 필요 시 선택 CodeTask 실행을 다시 시작하세요.";
          showToast(message);
          return { outcome: "blocked", message };
        }
        case "RETURN_TO_PLANNING_STAGE":
        case "START_QUICK_DESIGN_FROM_IMPLEMENTATION": {
          const pid = projectId.trim();
          if (pid) {
            window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
          }
          return { outcome: "executed" };
        }
        case "GENERATE_IMPLEMENTATION_WORK_PLAN":
          return generateImplementationWorkPlanDraft();
        case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
          return confirmImplementationTaskPlan();
        case "EDIT_IMPLEMENTATION_SCOPE":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionFocusComposerResult(
              "아래 입력란에 수정·범위 조정 요청을 적고 전송해 주세요.",
            ),
          );
          return { outcome: "executed" };
        case "REVIEW_DB_INTEGRATION":
          return reviewDbIntegrationNeed();
        case "GENERATE_DATA_MODEL_DRAFT":
          return generateDataModelDraft();
        case "CONFIRM_MOCK_IMPLEMENTATION":
          return confirmMockImplementationMode();
        case "SHOW_ARTIFACTS":
          applyImplementationStageActionExecutionResult(buildImplementationStageActionOpenArtifactsResult());
          return { outcome: "executed" };
        case "OPEN_ENV_SETTINGS":
          applyImplementationStageActionExecutionResult(buildImplementationStageActionOpenEnvSettingsResult());
          return { outcome: "executed" };
        case "SHOW_ROLE_CHECK":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionShowStatusResult("role"),
          );
          return { outcome: "executed" };
        case "SHOW_SCM_CHECK":
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionShowStatusResult("scm"),
          );
          return { outcome: "executed" };
        case "SHOW_ENV_CHECK":
          void refreshExecutionEnvironmentStatus().then(() => {
            applyImplementationStageActionExecutionResult(
              buildImplementationStageActionShowStatusResult("env"),
            );
          });
          return { outcome: "executed" };
        case "RUN_REVIEWER_CHECK":
          return runImplementationQualityGate("reviewer");
        case "RUN_SECURITY_CHECK":
          return runImplementationQualityGate("security");
        case "REQUEST_CODE_AGENT_WIP": {
          const pid = projectId.trim();
          const cursorApiReady = evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready;

          const prepared = prepareWipRequestRuntime({
            projectId: pid,
            baseState: parsedRequirementsState,
            pendingPatch: pendingImplementationPatch,
            envOk: effectiveImplementationState.envOk,
            designOk: effectiveImplementationState.designOk,
            cursorApiConfigured: cursorApiReady,
          });

          let runtimeState = prepared.state;
          let runtimeTaskPlan = prepared.taskPlan;
          let runtimeWorkItems = prepared.workItems;
          let runtimeSlots = runtimeState.implementationSlotsV1 ?? null;
          let runtimeDbStrategy = runtimeState.implementationDbStrategyV1 ?? null;
          let runtimeExecutionState = prepared.executionState;
          let runtimeTimeline = appendPromptTimelineEntries(
            runtimeState.promptTimeline,
            prepared.timelineEntries,
          );
          runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };

          const taskList = runtimeState.implementationTaskListV1;
          const seed = runtimeState.implementationSeedV1;
          const canUseTaskList = canUseTaskListForWipOrchestration({ taskList, seed });

          if (prepared.unconfirmedSlotsNote) {
            appendAiNoticeForImplementation(prepared.unconfirmedSlotsNote);
          }

          if (!runtimeWorkItems.length) {
            const message = "Code Agent WIP 작업 요청을 위해 구현 작업목록 또는 작업 계획이 필요합니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          if (
            !shouldUseTaskListBoardWipGate({ taskList, executionState: runtimeExecutionState }) &&
            pid &&
            canUseTaskList &&
            hasTaskListForWipOrchestration(taskList)
          ) {
            const derived = buildTaskListDerivedWipOrchestration({
              projectId: pid,
              taskList: taskList!,
              projectArtifacts: executionArtifacts.projectArtifacts,
              artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
              envOk: effectiveImplementationState.envOk,
              designOk: effectiveImplementationState.designOk,
              envCursorBadge: effectiveImplementationState.envOk ? "ok" : "needs",
              priorTimeline: runtimeTimeline,
              priorExecutionState: runtimeExecutionState,
            });
            runtimeTaskPlan = derived.plan;
            runtimeWorkItems = [...derived.workItems];
            runtimeSlots = derived.slots;
            runtimeDbStrategy = derived.dbStrategy;
            runtimeExecutionState = derived.executionState;
            runtimeState = mergeTaskListWipRuntimeState(runtimeState, derived);
            runtimeTimeline = runtimeState.promptTimeline ?? runtimeTimeline;
          }

          const reGate = evaluateImplementationCursorGate(
            buildImplementationCursorGateContext(
              {
                ...runtimeState,
                cursorWorkItemsV1: runtimeWorkItems,
                implementationTaskPlanV1: runtimeTaskPlan,
                implementationTaskExecutionStateV1: runtimeExecutionState,
              },
              {
                envOk: effectiveImplementationState.envOk,
                designOk: effectiveImplementationState.designOk,
              },
              { projectId: pid },
            ),
          );
          if (!reGate.allowed) {
            const message = formatImplementationCursorBlockedNotice(
              buildImplementationCursorGateContext(
                {
                  ...runtimeState,
                  cursorWorkItemsV1: runtimeWorkItems,
                  implementationTaskPlanV1: runtimeTaskPlan,
                  implementationTaskExecutionStateV1: runtimeExecutionState,
                },
                {
                  envOk: effectiveImplementationState.envOk,
                  designOk: effectiveImplementationState.designOk,
                },
                { projectId: pid },
              ),
            );
            if (runtimeWorkItems.length && runtimeExecutionState && taskList) {
              const failedState = markDeveloperTasksFailedForWip({
                state: runtimeExecutionState,
                cursorWorkItems: runtimeWorkItems,
                errorMessage: message,
              });
              void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
                implementationTaskExecutionStateV1: failedState,
              });
            }
            appendAiNoticeForImplementation(message);
            showToast("Code Agent WIP 요청을 시작하지 못했습니다. 개발자 작업 상태를 실패로 기록했습니다.");
            return { outcome: "blocked", message };
          }

          let workItemsForWip = runtimeWorkItems;
          let scopedTaskId: string | null = null;
          let wipCandidateCount: number | undefined;
          if (taskList && runtimeExecutionState) {
            const board = buildImplementationExecutionBoardFromRequirementsState({
              projectId: pid,
              orchestration: runtimeState,
            })!;
            wipCandidateCount = countTaskListWipCandidateTasks(board);
            const scoped = selectCursorWorkItemsForWipExecution({
              board,
              workItems: runtimeWorkItems,
              boardState: runtimeState.implementationExecutionBoardStateV1,
              qualityGateResults: runtimeState.implementationQualityGateResultsV1,
            });
            scopedTaskId = scoped.selectedTaskId;
            if (scopedTaskId) {
              runtimeTimeline = appendPromptTimelineEntries(runtimeTimeline, [
                buildImplementationWipGenerationTimelineEntry({
                  action: "implementation_wip_selected_task_resolved",
                  projectId: pid,
                  hasImplementationTaskList: true,
                  hasCursorWorkItems: true,
                  selectedTaskId: scopedTaskId,
                  selectedWorkItemCount: scoped.selectedWorkItems.length,
                  cursorApiConfigured: cursorApiReady,
                  nowIso: new Date().toISOString(),
                }),
              ]);
              runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };
            }
            if (!scoped.selectedWorkItems.length) {
              const message = formatTaskScopedWipExecutionBlockedNotice({
                selectedTaskId: scoped.selectedTaskId,
                blockedReason:
                  scoped.blockedReason ??
                  "실행 가능한 개발자 작업이 없어 Code Agent WIP 요청을 시작하지 못했습니다.",
              });
              appendAiNoticeForImplementation(message);
              return { outcome: "blocked", message };
            }
            if (scopedTaskId) {
              const scopeValidation = validateTaskScopedWorkItems({
                selectedTaskId: scopedTaskId,
                selectedWorkItems: scoped.selectedWorkItems,
              });
              if (!scopeValidation.ok) {
                appendAiNoticeForImplementation(scopeValidation.message);
                return { outcome: "blocked", message: scopeValidation.message };
              }
            }
            workItemsForWip = scoped.selectedWorkItems;
          } else if (runtimeWorkItems.length) {
            scopedTaskId = runtimeWorkItems[0]?.taskId ?? null;
            workItemsForWip = scopedTaskId
              ? runtimeWorkItems.filter((w) => w.taskId === scopedTaskId)
              : runtimeWorkItems.slice(0, 1);
          }

          const wipResult = executeCodeAgentWipWorkRequest(
            {
              projectId: pid,
              requirementsStateJson,
              parsedState: runtimeState,
              applyMessages: executionSingleChat.applyPersistedMessages,
              appendNotice: (text) => appendAiNoticeForImplementation(text),
              persistOrchestration: () => {
                // Full persist + local merge handled by applyImplementationOrchestrationResult below.
              },
              focusComposer: () => queueMicrotask(() => chatInputRef.current?.focus()),
              showToast,
            },
            {
              plan: runtimeTaskPlan,
              workItems: workItemsForWip,
              taskList: taskList ?? undefined,
              executionState: runtimeExecutionState,
              selectedTaskId: scopedTaskId,
              selectedWorkItemIds: workItemsForWip.map((w) => w.id),
              totalCandidateCount: wipCandidateCount,
              cursorWorkItemsV1: runtimeWorkItems ?? undefined,
              implementationTaskPlanV1: runtimeTaskPlan ?? undefined,
              promptTimeline: runtimeTimeline,
            },
          );

          if (wipResult.kind === "blocked") {
            appendAiNoticeForImplementation(wipResult.message);
            return { outcome: "blocked", message: wipResult.message };
          }
          if (wipResult.kind === "already_active") {
            showToast(
              "WIP 초안이 이미 있습니다. [Cursor 실행 요청]으로 실제 소스 생성을 진행하세요.",
            );
            return { outcome: "executed" };
          }

          const selectedTaskId = wipResult.selectedTaskId ?? scopedTaskId;
          const acceptedBoardState = selectedTaskId
            ? markReworkRequestsAcceptedForTask({
                state: runtimeState.implementationExecutionBoardStateV1,
                projectId: pid,
                taskId: selectedTaskId,
              })
            : runtimeState.implementationExecutionBoardStateV1;
          if (selectedTaskId && acceptedBoardState) {
            applyPendingFromOrchestrationPatch({
              implementationExecutionBoardStateV1: acceptedBoardState,
            });
          }
          const mergedOrchestrationAfterWip = {
            ...runtimeState,
            codeAgentWipExecutionV1: wipResult.orchestrationPatch.codeAgentWipExecutionV1,
            promptTimeline: wipResult.orchestrationPatch.promptTimeline,
            ...(wipResult.executionState
              ? { implementationTaskExecutionStateV1: wipResult.executionState }
              : {}),
            ...(acceptedBoardState ? { implementationExecutionBoardStateV1: acceptedBoardState } : {}),
          };

          const wip = wipResult.orchestrationPatch.codeAgentWipExecutionV1;
          const timelineTaskId = wip.selectedTaskId ?? selectedTaskId ?? "";
          const timelineBase = {
            projectId: pid,
            selectedTaskId: timelineTaskId,
            selectedWorkItemCount: wip.selectedWorkItemIds?.length ?? workItemsForWip.length,
            cursorApiReady,
            hasCodeAgentWipExecutionV1: true,
          };
          let timeline = [
            ...(wipResult.orchestrationPatch.promptTimeline ?? runtimeTimeline ?? []),
          ];
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_created",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_persisted",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_local_state_merged",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "legacy_cursor_bridge_diagnostic_removed",
              ...timelineBase,
            }),
          );

          const boardAfterWip = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: mergedOrchestrationAfterWip,
          });
          const boardMessage =
            boardAfterWip &&
            buildImplementationExecutionBoardMessage({
              board: boardAfterWip,
              nowIso: new Date().toISOString(),
              previewReady: prototypeRunSyncSnapshot.previewReady,
              hasExecutionState: true,
              codeAgentWipExecutionV1: wip,
              executionSetup: executionSetupRow,
            });
          if (boardMessage) {
            timeline = appendPromptTimeline(
              timeline,
              buildImplementationWipDraftLifecycleTimelineEntry({
                action: "implementation_wip_draft_board_refreshed",
                ...timelineBase,
              }),
            );
          }

          const staleSanitizeCtx = {
            implementationTaskListV1: runtimeState.implementationTaskListV1,
            cursorWorkItemsV1: runtimeWorkItems,
            implementationSeedV1: runtimeState.implementationSeedV1,
          };
          const baseMessages = wipResult.chatMessages;
          const rawNextMessages = boardMessage ? [...baseMessages, boardMessage] : baseMessages;
          const nextMessages = sanitizeImplementationConversationMessages(rawNextMessages, staleSanitizeCtx);
          applyImplementationOrchestrationResult({
            messages: nextMessages,
            orchestrationPatch: {
              codeAgentWipExecutionV1: wip,
              promptTimeline: timeline,
              ...(wipResult.executionState
                ? { implementationTaskExecutionStateV1: wipResult.executionState }
                : {}),
              ...(runtimeWorkItems?.length ? { cursorWorkItemsV1: [...runtimeWorkItems] } : {}),
              ...(runtimeTaskPlan ? { implementationTaskPlanV1: runtimeTaskPlan } : {}),
              ...(runtimeSlots ? { implementationSlotsV1: runtimeSlots } : {}),
              ...(runtimeDbStrategy ? { implementationDbStrategyV1: runtimeDbStrategy } : {}),
              ...(acceptedBoardState
                ? { implementationExecutionBoardStateV1: acceptedBoardState }
                : {}),
            },
          });

          const integratedWipSummary = Boolean(scopedTaskId && wipCandidateCount !== undefined);
          if (!integratedWipSummary) {
            const devCount = wipResult.developerTaskCount;
            const successNotice =
              devCount > 0
                ? `TaskList 기준 개발자 작업 ${devCount}건을 Code Agent WIP 요청으로 전환했습니다.`
                : "Code Agent WIP 작업 요청을 시작했습니다.";
            showToast(successNotice);
          } else {
            showToast("Code Agent WIP 초안이 생성되었습니다.");
          }
          return { outcome: "executed" };
        }
        case "REQUEST_TASK_CURSOR_EXECUTION": {
          const pid = projectId.trim();
          const board = implementationStageBoardGateContext?.board;
          const workItems = orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [];
          const codeTaskPlan = orchestrationAwareRequirementsState.implementationCodeTaskPlanV1;
          const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
          if (!board) {
            const message = "구현 Execution Board가 준비되지 않았습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const envGate = resolveTaskCursorExecutionEnvGate({ setup: executionSetupRow });
          if (envGate.blocked) {
            const message = envGate.message ?? "환경설정 점검이 필요합니다.";
            appendAiNoticeForImplementation(message);
            showToast(message);
            return { outcome: "blocked", message };
          }
          const parsedInFlight =
            parseTaskCursorExecutionV1(orchestrationAwareRequirementsState.taskCursorExecutionV1) ?? null;
          const inFlightRow = parsedInFlight
            ? board.taskRows.find((row) => row.taskId === parsedInFlight.taskId)
            : null;
          if (
            parsedInFlight &&
            isActiveTaskCursorExecution(parsedInFlight, {
              developerStatus: inFlightRow?.developerStatus ?? null,
            })
          ) {
            const message = CODE_TASK_IN_FLIGHT_USER_MESSAGE;
            appendAiNoticeForImplementation(message);
            showToast(message);
            return { outcome: "no_op", message };
          }
          const planningGate = evaluateImplementationPlanningExecutionGate({
            codeTaskPlan,
            cursorWorkItems: workItems,
            preflightSummary: orchestrationAwareRequirementsState.implementationWorkItemPreflightSummaryV1,
            codeTaskQualityGate: orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
          });
          if (!planningGate.ok) {
            const nowIso = new Date().toISOString();
            const blockedTimeline = appendPromptTimeline(
              orchestrationAwareRequirementsState.promptTimeline ?? [],
              buildImplementationExecutionBlockedByPlanningGateTimelineEntry({
                projectId: pid,
                reason: planningGate.reason,
                nowIso,
              }),
            );
            void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
              promptTimeline: blockedTimeline,
            });
            const message =
              planningGate.message ??
              IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE;
            appendAiNoticeForImplementation(
              `${message} [구현 준비 산출물 동기화] 또는 기획단계 보완 후 다시 시도해 주세요.`,
            );
            showToast(message);
            return { outcome: "blocked", message };
          }
          const queueDispatch =
            pendingQuickRunQueueDispatchRef.current ?? persistedQueueDispatch;
          pendingQuickRunQueueDispatchRef.current = null;
          if (queueDispatch) {
            const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
              gitRepoUrl: executionSetupRow?.gitRepoUrl,
              gitRepoName: executionSetupRow?.gitRepoName,
              gitRepoProvider: executionSetupRow?.gitRepoProvider,
              baseBranch: executionSetupRow?.baseBranch,
            });
            if (!targetRepository) {
              const message = "GitHub 저장소 설정이 없습니다. 환경설정을 확인해 주세요.";
              appendAiNoticeForImplementation(message);
              return { outcome: "blocked", message };
            }
            const nowIso = new Date().toISOString();
            const allowedPathGlobs = parseStringArrayJson(executionSetupRow?.allowedPathGlobs);
            const prep = prepareSelectedCodeTaskCursorExecution({
              projectId: pid,
              queueDispatch,
              runs:
                parseCodeTaskExecutionRunsV1(
                  parseRequirementsStateJson(requirementsStateJsonRef.current).codeTaskExecutionRunsV1,
                ) ??
                parseCodeTaskExecutionRunsV1(orchestrationAwareRequirementsState.codeTaskExecutionRunsV1),
              codeTaskPlan,
              taskList,
              cursorWorkItems: workItems,
              targetRepository,
              baseBranch: executionSetupRow?.baseBranch ?? targetRepository.defaultBranch,
              allowedPathGlobs,
              codeTaskPromptContextMapV1:
                orchestrationAwareRequirementsState.codeTaskPromptContextMapV1 ?? null,
              existingTaskCursor:
                parseTaskCursorExecutionV1(orchestrationAwareRequirementsState.taskCursorExecutionV1) ??
                null,
              nowIso,
            });
            if (!prep.ok) {
              appendAiNoticeForImplementation(prep.message);
              showToast(prep.message);
              return { outcome: prep.outcome, message: prep.message };
            }
            const { prepared } = prep;
            const codeTaskTitle = codeTaskPlan?.tasks.find(
              (t) => t.codeTaskId === prepared.codeTaskId,
            )?.title;
            applyImplementationOrchestrationResult(
              {
                messages: executionSingleChat.chatMessages,
                orchestrationPatch: {
                  ...buildTaskCursorOrchestrationPatch({
                    execution: prepared.pendingExecution,
                    history: orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
                    timelineEntries: [],
                    existingTimeline: orchestrationAwareRequirementsState.promptTimeline,
                    cursorWorkItems: [...prepared.selectedWorkItems],
                    existingCodeTaskExecutionFeedback:
                      orchestrationAwareRequirementsState.implementationCodeTaskExecutionFeedbackV1,
                    codeTaskQualityGate:
                      orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
                    implementationExecutionJobsV1:
                      orchestrationAwareRequirementsState.implementationExecutionJobsV1,
                    codeTaskExecutionRunsV1: (() => {
                      const existingRuns =
                        parseCodeTaskExecutionRunsV1(
                          orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
                        ) ?? [];
                      return existingRuns.some((r) => r.runId === prepared.run.runId)
                        ? updateCodeTaskExecutionRun(existingRuns, prepared.run.runId, prepared.run)
                        : appendCodeTaskExecutionRun(existingRuns, prepared.run);
                    })(),
                    activeCodeTaskId: prepared.codeTaskId,
                    activeWorkItemId: prepared.workItem.id,
                  }),
                  cursorWorkItemsV1: mergeCursorWorkItemsByTask({
                    existingWorkItems: orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [],
                    updatedWorkItems: [...prepared.selectedWorkItems],
                    taskId: prepared.parentTaskId,
                  }),
                },
              },
              { persist: false },
            );
            showToast(
              buildCodeTaskRunLaunchToastMessage({
                codeTaskId: prepared.codeTaskId,
                codeTaskTitle,
              }),
            );
            const pollHistory = orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1;
            const pollTimeline = orchestrationAwareRequirementsState.promptTimeline;
            const pollWorkItems = [...prepared.selectedWorkItems];
            void (async () => {
              try {
                const res = await postTaskCursorExecuteWithRetry({
                  body: prepared.requestBody,
                });
                const json = (await res.json()) as {
                  success?: boolean;
                  message?: string;
                  pollRequired?: boolean;
                  serverPolling?: boolean;
                  phase?: string;
                  failureReason?: string;
                  orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
                };
                const preflightFailure = isTaskCursorExecutePromptPreflightFailure(json);
                if (json.orchestrationPatch) {
                  applyImplementationOrchestrationResult({
                    messages: executionSingleChat.chatMessages,
                    orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch),
                  });
                }
                const launchedExecution =
                  parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                  parseTaskCursorExecutionV1(requirementsStateJsonRef.current.taskCursorExecutionV1) ??
                  prepared.pendingExecution;
                const userStatus = buildCodeTaskRunUserStatus(
                  findLatestRunForCodeTask(
                    parseCodeTaskExecutionRunsV1(
                      requirementsStateJsonRef.current.codeTaskExecutionRunsV1,
                    ),
                    prepared.codeTaskId,
                  ),
                );
                if (
                  (json.serverPolling || json.pollRequired) &&
                  launchedExecution.status === "cursor_running"
                ) {
                  showToast(`${codeTaskTitle ?? prepared.codeTaskId} · ${userStatus.label}`);
                  return;
                }
                const notice =
                  json.message ??
                  (json.success ? `${userStatus.label} 처리되었습니다.` : "CodeTask 실행에 실패했습니다.");
                if (!json.success && !json.pollRequired && !preflightFailure) {
                  applyImplementationOrchestrationResult({
                    messages: executionSingleChat.chatMessages,
                    orchestrationPatch: buildTaskCursorFailedOrchestrationPatch({
                      execution:
                        parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                        prepared.pendingExecution,
                      message: notice,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    }),
                  });
                }
                if (!preflightFailure) {
                  appendAiNoticeForImplementation(notice);
                }
                showToast(notice);
              } catch (e) {
                const friendly = formatTransientTaskCursorLaunchErrorMessage(e);
                const orchestrationPatch = isTransientTaskCursorLaunchError(friendly)
                  ? buildTaskCursorLaunchTransientFailurePatch({
                      execution: prepared.pendingExecution,
                      message: friendly,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    })
                  : buildTaskCursorFailedOrchestrationPatch({
                      execution: prepared.pendingExecution,
                      message: friendly,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    });
                applyImplementationOrchestrationResult({
                  messages: executionSingleChat.chatMessages,
                  orchestrationPatch,
                });
                appendAiNoticeForImplementation(`CodeTask 실행 오류: ${friendly}`);
                showToast(`CodeTask 실행 오류: ${friendly}`);
              }
            })();
            return { outcome: "executed" };
          }
          const preferredTaskId = codeTaskDispatchPreferredTaskIdRef.current?.trim() || null;
          codeTaskDispatchPreferredTaskIdRef.current = null;
          const manualTaskId = boardManualPickTaskIdRef.current?.trim() || null;
          boardManualPickTaskIdRef.current = null;
          const explicitTaskId = manualTaskId ?? preferredTaskId;
          const quickRun = parseImplementationQuickRunV1(
            orchestrationAwareRequirementsState.implementationQuickRunV1,
          );
          const allowedTaskIds = resolveQuickRunAllowedTaskIds(quickRun);
          let scoped = selectCursorWorkItemsForWipExecution({
            board,
            workItems,
            boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
            qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
            allowedTaskIds,
          });
          if (explicitTaskId) {
            const preferredWorkItems = workItems.filter((item) => item.taskId === explicitTaskId);
            if (preferredWorkItems.length) {
              scoped = {
                selectedTaskId: explicitTaskId,
                selectedWorkItems: preferredWorkItems,
              };
            }
          }
          if (!scoped.selectedTaskId || !scoped.selectedWorkItems.length) {
            const message = scoped.blockedReason ?? "실행 가능한 Task를 찾을 수 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
            gitRepoUrl: executionSetupRow?.gitRepoUrl,
            gitRepoName: executionSetupRow?.gitRepoName,
            gitRepoProvider: executionSetupRow?.gitRepoProvider,
            baseBranch: executionSetupRow?.baseBranch,
          });
          if (!targetRepository) {
            const message = "GitHub 저장소 설정이 없습니다. 환경설정을 확인해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const nowIso = new Date().toISOString();
          const allowedPathGlobs = parseStringArrayJson(executionSetupRow?.allowedPathGlobs);
          let selectedWorkItems = [...scoped.selectedWorkItems];

          if (!selectedWorkItems.length) {
            const message = scoped.blockedReason ?? "선택 Task에 연결된 WorkItem이 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          const refinement = taskList
            ? refineCursorWorkItemsForImplementation({
                projectId: pid,
                taskList,
                workItems: selectedWorkItems,
                selectedTaskId: scoped.selectedTaskId,
                allowedPathGlobs,
                targetRepository,
                nowIso,
              })
            : {
                workItems: selectedWorkItems,
                blockedWorkItemIds: [],
                timelineEntries: [],
              };
          selectedWorkItems = [...refinement.workItems];
          if (!selectedWorkItems.length) {
            const message = "WorkItem 보정 후 실행 가능한 항목이 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          const preflight = runWorkItemPreflightBatch({
            workItems: selectedWorkItems,
            allowedPathGlobs,
          });
          let preflightTimeline = orchestrationAwareRequirementsState.promptTimeline ?? [];
          for (const entry of refinement.timelineEntries) {
            preflightTimeline = appendPromptTimeline(preflightTimeline, entry);
          }
          preflightTimeline = appendPromptTimeline(
            preflightTimeline,
            buildWorkItemPreflightTimelineEntry({
              projectId: pid,
              taskId: scoped.selectedTaskId,
              result: preflight,
              nowIso,
            }),
          );

          if (preflight.status === "failed") {
            const message = formatWorkItemPreflightBlockedMessage(preflight);
            const failedRequest = buildTaskCursorExecutionRequest({
              projectId: pid,
              taskId: scoped.selectedTaskId,
              workItemIds: selectedWorkItems.map((item) => item.id),
              workItems: selectedWorkItems,
              targetRepository,
              baseBranch: targetRepository.defaultBranch,
              allowedPathGlobs,
              existing:
                orchestrationAwareRequirementsState.taskCursorExecutionV1?.taskId === scoped.selectedTaskId
                  ? orchestrationAwareRequirementsState.taskCursorExecutionV1
                  : null,
              nowIso,
            });
            applyImplementationOrchestrationResult({
              messages: executionSingleChat.chatMessages,
              orchestrationPatch: {
                ...buildTaskCursorFailedOrchestrationPatch({
                  execution: failedRequest,
                  message,
                  reason: "work_item_preflight_failed",
                  history: orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
                  existingTimeline: preflightTimeline,
                  nowIso,
                  cursorWorkItems: selectedWorkItems,
                  existingCodeTaskExecutionFeedback:
                    orchestrationAwareRequirementsState.implementationCodeTaskExecutionFeedbackV1,
                  codeTaskQualityGate:
                    orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
                }),
                cursorWorkItemsV1: mergeCursorWorkItemsByTask({
                  existingWorkItems: orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [],
                  updatedWorkItems: selectedWorkItems.map((item) => ({
                    ...item,
                    refinementStatus: "preflight_failed" as const,
                  })),
                  taskId: scoped.selectedTaskId,
                }),
              },
            });
            appendAiNoticeForImplementation(message);
            showToast("WorkItem 보완 필요 · Cursor 실행을 시작하지 않았습니다.");
            return { outcome: "blocked", message };
          }

          selectedWorkItems = selectedWorkItems.map((item) => ({
            ...item,
            refinementStatus: "preflight_passed" as const,
          }));
          scoped = {
            selectedTaskId: scoped.selectedTaskId,
            selectedWorkItems,
          };

          const pendingExecution = buildTaskCursorExecutionRequest({
            projectId: pid,
            taskId: scoped.selectedTaskId,
            workItemIds: scoped.selectedWorkItems.map((w) => w.id),
            workItems: scoped.selectedWorkItems,
            targetRepository,
            baseBranch: targetRepository.defaultBranch,
            allowedPathGlobs,
            existing:
              orchestrationAwareRequirementsState.taskCursorExecutionV1?.taskId === scoped.selectedTaskId
                ? orchestrationAwareRequirementsState.taskCursorExecutionV1
                : null,
            nowIso,
          });
          showToast(`Cursor 실행 요청 중 · ${scoped.selectedTaskId}`);
          const pollHistory = orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1;
          const pollTimeline = orchestrationAwareRequirementsState.promptTimeline;
          const pollWorkItems = scoped.selectedWorkItems;

          void (async () => {
            try {
              const res = await postTaskCursorExecuteWithRetry({
                body: {
                  projectId: pid,
                  taskId: scoped.selectedTaskId,
                  selectedWorkItemIds: scoped.selectedWorkItems.map((w) => w.id),
                  workItems: scoped.selectedWorkItems,
                  verifyGithub: true,
                  launchOnly: true,
                },
              });
              const json = (await res.json()) as {
                success?: boolean;
                message?: string;
                pollRequired?: boolean;
                serverPolling?: boolean;
                jobId?: string;
                phase?: string;
                failureReason?: string;
                execution?: { status?: string; errorMessage?: string; failureReason?: string };
                orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
              };
              const preflightFailure = isTaskCursorExecutePromptPreflightFailure(json);
              if (json.orchestrationPatch) {
                applyImplementationOrchestrationResult({
                  messages: executionSingleChat.chatMessages,
                  orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch),
                });
              }
              const launchedExecution =
                parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                parseTaskCursorExecutionV1(requirementsStateJsonRef.current.taskCursorExecutionV1) ??
                pendingExecution;

              if (
                (json.serverPolling || json.pollRequired) &&
                launchedExecution.status === "cursor_running"
              ) {
                showToast(`${scoped.selectedTaskId} · Cursor 작업 중`);
                return;
              }

              const notice =
                json.execution?.errorMessage ??
                json.message ??
                (json.success ? "Task Cursor 실행이 완료되었습니다." : "Task Cursor 실행에 실패했습니다.");
              if (!json.success && !json.pollRequired && !preflightFailure) {
                applyImplementationOrchestrationResult({
                  messages: executionSingleChat.chatMessages,
                  orchestrationPatch: buildTaskCursorFailedOrchestrationPatch({
                    execution:
                      parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                      pendingExecution,
                    message: notice,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  }),
                });
              }
              if (!preflightFailure) {
                appendAiNoticeForImplementation(notice);
              }
              showToast(notice);
            } catch (e) {
              const friendly = formatTransientTaskCursorLaunchErrorMessage(e);
              const orchestrationPatch = isTransientTaskCursorLaunchError(friendly)
                ? buildTaskCursorLaunchTransientFailurePatch({
                    execution: pendingExecution,
                    message: friendly,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  })
                : buildTaskCursorFailedOrchestrationPatch({
                    execution: pendingExecution,
                    message: friendly,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  });
              applyImplementationOrchestrationResult({
                messages: executionSingleChat.chatMessages,
                orchestrationPatch,
              });
              appendAiNoticeForImplementation(`Task Cursor 실행 오류: ${friendly}`);
              showToast(`Task Cursor 실행 오류: ${friendly}`);
            }
          })();
          return { outcome: "executed" };
        }
        case "VERIFY_TASK_CURSOR_GITHUB": {
          const pid = projectId.trim();
          const execution = parseTaskCursorExecutionV1(
            orchestrationAwareRequirementsState.taskCursorExecutionV1,
          );
          if (!execution) {
            return { outcome: "blocked", message: "Task Cursor 실행 상태가 없습니다." };
          }
          showToast("GitHub commit 결과를 확인합니다...");
          void (async () => {
            try {
              const state = parseRequirementsStateJson(requirementsStateJsonRef.current);
              const json = await postTaskCursorGithubVerify(
                buildTaskCursorGithubVerifyRequestBody({
                  projectId: pid,
                  execution,
                  state,
                }),
              );
              applyTaskCursorGithubVerifyApiResult({
                json,
                enrichPatch: enrichCodeTaskRunOrchestrationPatch,
                applyOrchestrationPatch: (patch) => {
                  applyImplementationOrchestrationResult({
                    messages: executionSingleChat.chatMessages,
                    orchestrationPatch: patch,
                  });
                },
                shouldApplyNextDispatch: (next) =>
                  quickRunCodeTaskContinuationRef.current !== next.triggerKey,
                onNextQuickRunDispatch: (next) => {
                  quickRunCodeTaskContinuationRef.current = next.triggerKey;
                  dispatchNextQuickRunFromGithubVerify(next);
                },
              });
              const notice = resolveTaskCursorGithubVerifyUserNotice(json);
              showImplementationToast(notice);
              void fetchImplementationRuntime(pid).then((fetched) => {
                if (fetched.success) applyImplementationRuntimeFetch(fetched);
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              showToast(`GitHub 확인 오류: ${message}`);
            }
          })();
          return { outcome: "executed" };
        }
        case "REQUEST_CURSOR_BRIDGE_EXECUTION": {
          const pid = projectId.trim();
          const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
          if (!wip) {
            const message =
              "WIP 초안 또는 Cursor 실행 결과가 저장되어 있지 않습니다. 먼저 [생성요청]을 실행해 WIP 초안을 생성해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const bridgeStatus = wip.bridgeExecutionStatus;
          if (
            bridgeStatus !== "draft_created" &&
            bridgeStatus !== "draft_approved" &&
            bridgeStatus !== "failed"
          ) {
            const message = `현재 bridge 상태(${bridgeStatus ?? "unknown"})에서는 Cursor 실행 요청을 할 수 없습니다.`;
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const selectedTaskId = wip.selectedTaskId?.trim();
          const selectedWorkItemIds = wip.selectedWorkItemIds ?? [];
          if (!selectedTaskId || !selectedWorkItemIds.length) {
            const message = "WIP 실행 대상 taskId 또는 workItem이 없습니다. [생성요청]을 다시 실행해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const bridgeWorkItems = orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [];
          const workItems = bridgeWorkItems.filter((w) => selectedWorkItemIds.includes(w.id));
          const bridgeTaskList = orchestrationAwareRequirementsState.implementationTaskListV1;
          if (!workItems.length) {
            const message = "선택된 Cursor WorkItem을 찾을 수 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const stubCommit = wip.commits.find((c) => c.sha?.startsWith("wip-stub"));
          const commitMessage = stubCommit?.commitMessage ?? `wip(cursor): [${selectedTaskId}]`;
          const bridgeRunId = `cursor-bridge-${new Date().toISOString().replace(/[:.]/g, "")}`;

          void (async () => {
            const refTimeline = () =>
              parseRequirementsStateJson(requirementsStateJsonRef.current).promptTimeline ?? [];

            const applyBridgeFailure = (message: string, openEnv = false) => {
              const blocked = buildCursorBridgeApiBlockedResult({ selectedTaskId, message });
              const orchestration = buildCursorBridgeOrchestrationResult({
                requirementsStateJson: requirementsStateJsonRef.current,
                wip: patchWipForCursorBridgePhase({
                  wip,
                  phase: "running",
                  targetRepository: wip.targetRepoFullName ?? wip.targetRepository,
                }),
                bridgeResult: blocked,
                promptTimeline: refTimeline(),
                runId: bridgeRunId,
              });
              if (orchestration.orchestrationPatch) {
                applyImplementationOrchestrationResult({
                  messages: orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
                  orchestrationPatch: orchestration.orchestrationPatch,
                });
              } else {
                appendAiNoticeForImplementation(message);
              }
              showToast(message);
              if (openEnv) setExecutionEnvironmentModalOpen(true);
            };

            const setupRes = await fetchExecutionSetup(pid);
            const executionSetup =
              setupRes.res.ok && setupRes.json.success ? (setupRes.json.data ?? null) : null;
            const readiness = evaluateExecutionSetupSourceGenerationReadiness({
              setup: executionSetup
                ? {
                    gitRepoUrl: executionSetup.gitRepoUrl,
                    gitRepoName: executionSetup.gitRepoName,
                    gitRepoProvider: executionSetup.gitRepoProvider,
                    baseBranch: executionSetup.baseBranch,
                    workspacePath: executionSetup.workspacePath,
                    allowedPathGlobs: executionSetup.allowedPathGlobs,
                    autoCommit: executionSetup.autoCommit,
                    autoPush: executionSetup.autoPush,
                    autoPr: executionSetup.autoPr,
                    cursorApiUrl: executionSetup.cursorApiUrl,
                    hasCursorToken: executionSetup.hasCursorToken,
                    hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                  }
                : null,
            });
            const setupRow = executionSetup
              ? {
                  gitRepoUrl: executionSetup.gitRepoUrl,
                  gitRepoName: executionSetup.gitRepoName,
                  gitRepoProvider: executionSetup.gitRepoProvider,
                  baseBranch: executionSetup.baseBranch,
                  workspacePath: executionSetup.workspacePath,
                  allowedPathGlobs: executionSetup.allowedPathGlobs,
                  autoCommit: executionSetup.autoCommit,
                  autoPush: executionSetup.autoPush,
                  autoPr: executionSetup.autoPr,
                  cursorApiUrl: executionSetup.cursorApiUrl,
                  hasCursorToken: executionSetup.hasCursorToken,
                  hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                }
              : null;

            if (!isCursorBridgeConfiguredForSourceGeneration({ setup: setupRow })) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({ setup: setupRow, wip }).join("\n");
              applyBridgeFailure(`${CURSOR_API_NOT_CONFIGURED_MESSAGE}\n\n${diagnostic}`, true);
              return;
            }

            const cursorAvailability = evaluateCursorExecutionAvailability({ setup: setupRow });
            const availabilityTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_availability_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: setupRow?.gitRepoName ?? undefined,
              workspacePath: setupRow?.workspacePath ?? undefined,
              branchName: wip.branchName,
              status: cursorAvailability.status,
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });

            if (!cursorAvailability.ready) {
              applyBridgeFailure(cursorAvailability.reason, true);
              return;
            }

            if (!readiness.ok) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({
                setup: setupRow,
                workspaceOriginStatus: "unchecked",
                wip,
              }).join("\n");
              applyBridgeFailure(`${readiness.message}\n\n${diagnostic}`, readiness.missing.some(
                (m) => m.includes("Git") || m.includes("실행환경") || m.includes("Workspace"),
              ));
              return;
            }

            const targetRepository = readiness.context.targetRepository;
            const targetSnapshot = toCodeAgentTargetRepositorySnapshot(targetRepository);

            const e2eDiagnostic = formatTargetRepoE2eDiagnosticLines({
              context: readiness.context,
              workspaceOriginStatus:
                readiness.context.workspaceRootSource === "env_fallback" ? "not_applicable" : "unchecked",
              wip,
            }).join("\n");
            appendAiNoticeForImplementation(
              ["Target Repo 수동 E2E 진단:", "", e2eDiagnostic].join("\n"),
            );
            const readinessTimeline = buildTargetRepoE2eTimelineEntry({
              action: "target_repo_e2e_readiness_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              baseBranch: readiness.context.baseBranch,
              workspacePath: readiness.context.workspaceRoot,
              status: "ready",
              nowIso: new Date().toISOString(),
            });

            showToast("Cursor API 직접 실행을 시작합니다...");
            const requestedTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_direct_execution_requested",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              workspacePath: readiness.context.workspaceRoot,
              branchName: wip.branchName,
              status: cursorAvailability.mode,
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });
            const requestedWip = patchWipForCursorBridgePhase({
              wip,
              phase: "requested",
              targetRepository: targetRepository.repoFullName,
              targetRepositorySnapshot: targetSnapshot,
              workspacePath: readiness.context.workspaceRoot,
              baseBranch: readiness.context.baseBranch,
              allowedPathGlobs: readiness.context.allowedPathGlobs,
            });
            applyImplementationOrchestrationResult({
              messages: executionSingleChat.chatMessages,
              orchestrationPatch: {
                codeAgentWipExecutionV1: requestedWip,
                promptTimeline: [...refTimeline(), availabilityTimeline, readinessTimeline, requestedTimeline],
              },
            });

            const runningWip = patchWipForCursorBridgePhase({
              wip: requestedWip,
              phase: "running",
            });
            const startedTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_direct_execution_started",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              workspacePath: readiness.context.workspaceRoot,
              branchName: wip.branchName,
              status: "running",
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });
            applyImplementationOrchestrationResult({
              messages: executionSingleChat.chatMessages,
              orchestrationPatch: {
                codeAgentWipExecutionV1: runningWip,
                promptTimeline: [...refTimeline(), startedTimeline],
              },
            });

            try {
              const routeCallingTimeline = buildCursorApiDirectTimelineEntry({
                action: "cursor_bridge_execute_route_calling",
                projectId: pid,
                selectedTaskId,
                repoFullName: targetRepository.repoFullName,
                workspacePath: readiness.context.workspaceRoot,
                branchName: wip.branchName,
                status: "calling",
                runId: bridgeRunId,
                changedFilesCount: workItems.length,
                nowIso: new Date().toISOString(),
              });
              applyImplementationOrchestrationResult({
                messages: executionSingleChat.chatMessages,
                orchestrationPatch: {
                  codeAgentWipExecutionV1: runningWip,
                  promptTimeline: [...refTimeline(), routeCallingTimeline],
                },
              });

              const res = await fetch("/api/prototype/cursor-bridge/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: pid,
                  selectedTaskId,
                  selectedWorkItemIds,
                  workItems,
                  branchName: wip.branchName,
                  commitMessage,
                }),
              });
              const json = (await res.json()) as {
                success?: boolean;
                message?: string;
                result?: import("@/lib/prototype/cursorBridgeExecution").CursorBridgeExecuteResult;
              };
              const bridgeResult =
                json.result ??
                buildCursorBridgeApiBlockedResult({
                  selectedTaskId,
                  message: json.message ?? "Cursor API 응답이 올바르지 않습니다.",
                });
              if (!json.result) {
                if (String(json.message ?? "").includes("일치하지 않습니다")) {
                  applyImplementationOrchestrationResult({
                    messages: executionSingleChat.chatMessages,
                    orchestrationPatch: {
                      promptTimeline: [
                        ...refTimeline(),
                        buildTargetRepoE2eTimelineEntry({
                          action: "target_repo_workspace_origin_mismatch",
                          projectId: pid,
                          selectedTaskId,
                          repoFullName: targetRepository.repoFullName,
                          workspacePath: readiness.context.workspaceRoot,
                          status: "blocked",
                          reason: json.message,
                        }),
                      ],
                    },
                  });
                }
              }
              const orchestration = buildCursorBridgeOrchestrationResult({
                requirementsStateJson: requirementsStateJsonRef.current,
                wip: runningWip,
                bridgeResult,
                promptTimeline: refTimeline(),
                runId: bridgeRunId,
              });
              if (orchestration.kind === "blocked" || orchestration.kind === "failed") {
                const mismatchTimeline = String(json.message ?? orchestration.message ?? "").includes(
                  "일치하지 않습니다",
                )
                    ? buildTargetRepoE2eTimelineEntry({
                        action: "target_repo_workspace_origin_mismatch",
                        projectId: pid,
                        selectedTaskId,
                        repoFullName: targetRepository.repoFullName,
                        workspacePath: readiness.context.workspaceRoot,
                        status: "blocked",
                        reason: json.message,
                      })
                    : null;
                if (orchestration.orchestrationPatch) {
                  applyImplementationOrchestrationResult({
                    messages: orchestration.chatPatch?.messages ?? executionSingleChat.chatMessages,
                    orchestrationPatch: {
                      ...orchestration.orchestrationPatch,
                      ...(mismatchTimeline
                        ? {
                            promptTimeline: [
                              ...(orchestration.orchestrationPatch.promptTimeline ?? []),
                              mismatchTimeline,
                            ],
                          }
                        : {}),
                    },
                  });
                } else {
                  appendAiNoticeForImplementation(orchestration.message);
                }
                showToast(orchestration.message);
                return;
              }
              if (orchestration.chatPatch && orchestration.orchestrationPatch) {
                const approvedWip = orchestration.orchestrationPatch.codeAgentWipExecutionV1;
                const refState = parseRequirementsStateJson(requirementsStateJsonRef.current);
                const executionState = syncDeveloperTaskExecutionFromCodeAgentWip({
                  state: refState.implementationTaskExecutionStateV1,
                  taskList: bridgeTaskList ?? undefined,
                  cursorWorkItems: bridgeWorkItems,
                  codeAgentWipExecutionV1: approvedWip,
                  projectId: pid,
                });
                applyImplementationOrchestrationResult({
                  messages: orchestration.chatPatch.messages,
                  orchestrationPatch: {
                    ...orchestration.orchestrationPatch,
                    ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
                  },
                });
                if (selectedTaskId) {
                  const acceptedBoardState = markReworkRequestsAcceptedForTask({
                    state: refState.implementationExecutionBoardStateV1,
                    projectId: pid,
                    taskId: selectedTaskId,
                  });
                  void persistChatToDb(undefined, {
                    implementationExecutionBoardStateV1: acceptedBoardState,
                  });
                }
                const board = buildImplementationExecutionBoardFromRequirementsState({
                  projectId: pid,
                  orchestration: {
                    ...refState,
                    codeAgentWipExecutionV1: approvedWip,
                    implementationTaskExecutionStateV1: executionState ?? undefined,
                  },
                });
                if (board) {
                  appendImplementationTaskListAiMessage(
                    buildImplementationExecutionBoardMessage({
                      board,
                      nowIso: new Date().toISOString(),
                      previewReady: prototypeRunSyncSnapshot.previewReady,
                      codeAgentWipExecutionV1: approvedWip,
                      executionSetup: executionSetupRow,
                    }),
                  );
                }
                showToast(orchestration.message);
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              const routeFailedTimeline = buildCursorApiDirectTimelineEntry({
                action: "cursor_bridge_execute_route_failed",
                projectId: pid,
                selectedTaskId,
                repoFullName: targetRepository.repoFullName,
                workspacePath: readiness.context.workspaceRoot,
                branchName: wip.branchName,
                status: "failed",
                runId: bridgeRunId,
                reason: message,
                nowIso: new Date().toISOString(),
              });
              applyImplementationOrchestrationResult({
                messages: executionSingleChat.chatMessages,
                orchestrationPatch: {
                  codeAgentWipExecutionV1: runningWip,
                  promptTimeline: [...refTimeline(), routeFailedTimeline],
                },
              });
              applyBridgeFailure(`Cursor API 실행 오류: ${message}`);
            }
          })();

          return { outcome: "executed" };
        }
        case "RESOLVE_USER_CONFIRMATION": {
          const pid = projectId.trim();
          const nextBoardState = resolveAllPendingUserConfirmations({
            state: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
          });
          void persistChatToDb(undefined, {
            implementationExecutionBoardStateV1: nextBoardState,
          });
          const notice = "사용자 확인 항목을 처리했습니다. 후속 작업을 이어갈 수 있습니다.";
          appendAiNoticeForImplementation(notice);
          showToast(notice);
          queueMicrotask(() => chatInputRef.current?.focus());
          return { outcome: "executed" };
        }
        case "SHOW_USER_CONFIRMATION_ITEMS": {
          const pid = projectId.trim();
          const result = tryAppendImplementationUserConfirmationBoardMessage({
            board: buildImplementationExecutionBoardFromRequirementsState({
              projectId: pid,
              orchestration: parsedRequirementsState,
            }),
            nowIso: new Date().toISOString(),
            appendAiMessage: appendImplementationTaskListAiMessage,
            showToast,
          });
          if (result.kind === "appended") return { outcome: "executed" };
          return { outcome: "blocked", message: result.message };
        }
        case "REQUEST_TASK_REWORK": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          if (!board) {
            const message = "구현 작업목록이 없어 재작업 요청을 등록할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const taskId = pickTaskIdForReworkRequest(board, boardManualPickTaskIdRef.current);
          boardManualPickTaskIdRef.current = null;
          if (!taskId) {
            const message = "재작업 요청을 등록할 대상 작업이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const nowIso = new Date().toISOString();
          const nextBoardState = appendReworkRequest({
            state: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
            taskId,
            targetRole: "developer",
            reason: "사용자 재작업 요청: 구현 결과 보완 필요",
            nowIso,
          });
          void persistChatToDb(undefined, {
            implementationExecutionBoardStateV1: nextBoardState,
          });
          const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: {
              ...parsedRequirementsState,
              implementationExecutionBoardStateV1: nextBoardState,
            },
          });
          if (nextBoard) {
            appendImplementationTaskListAiMessage(
              buildImplementationExecutionBoardMessage({
                board: nextBoard,
                nowIso,
                previewReady: prototypeRunSyncSnapshot.previewReady,
                executionSetup: executionSetupRow,
              }),
            );
          }
          const notice = buildReworkRequestRegistrationNotice({
            board: nextBoard ?? board,
            taskId,
          });
          appendAiNoticeForImplementation(notice);
          showToast(notice.split("\n")[0] ?? notice);
          return { outcome: "executed" };
        }
        case "MOVE_TO_REVIEW_STAGE": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          const integratedAppPreviewReady = resolveIntegratedAppPreviewReadyFromOrchestration({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          if (
            !board ||
            !isImplementationReadyForReviewStage({
              board,
              previewReady: integratedAppPreviewReady,
              integratedAppPreviewReady,
            })
          ) {
            const message = !integratedAppPreviewReady
              ? "실제 앱 Preview가 준비되지 않아 검토단계로 이동할 수 없습니다. 최종 Wiring·통합·build 검증을 완료해 주세요."
              : "구현 실행 보드가 완료되지 않아 검토단계로 이동할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const reviewMarker = buildImplementationReviewStageReadyMarker({
            previewReady: integratedAppPreviewReady,
            nowIso: new Date().toISOString(),
          });
          const previewUrlForReview =
            previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined;
          let session =
            parsedRequirementsState.reviewStageUserTestSessionV1 ??
            buildInitialReviewStageUserTestSession({
              projectId: pid,
              previewUrl: previewUrlForReview,
            });
          void persistChatToDb(undefined, {
            implementationReviewStageReadyV1: reviewMarker,
            reviewStageUserTestSessionV1: session,
          });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: reviewMarker,
              previewReady: integratedAppPreviewReady,
              session,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrlForReview,
            }),
          );
          const message =
            "검토단계로 이동할 수 있습니다. 좌측 [검토] 메뉴에서 프로토타입 사용자 테스트를 진행하세요.";
          appendAiNoticeForImplementation(message);
          showToast(message);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_OPEN_PREVIEW": {
          const url = previewUrl ?? prototypeRunSyncSnapshot.previewUrl;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            return { outcome: "executed" };
          }
          showToast("Preview URL이 아직 없습니다.");
          return { outcome: "blocked", message: "Preview URL이 아직 없습니다." };
        }
        case "REVIEW_STAGE_START_USER_TEST": {
          const pid = projectId.trim();
          const previewUrlForReview =
            previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined;
          const session = markReviewStageUserTestStarted({
            session: parsedRequirementsState.reviewStageUserTestSessionV1,
            projectId: pid,
            previewUrl: previewUrlForReview,
          });
          void persistChatToDb(undefined, { reviewStageUserTestSessionV1: session });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: parsedRequirementsState.implementationReviewStageReadyV1,
              previewReady: prototypeRunSyncSnapshot.previewReady,
              session,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrlForReview,
            }),
          );
          const notice = "사용자 테스트를 시작했습니다. Preview에서 화면·흐름·문구를 확인해 주세요.";
          appendAiNoticeForImplementation(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_ADD_FEEDBACK": {
          applyImplementationStageActionExecutionResult(
            buildImplementationStageActionFocusComposerResult(REVIEW_STAGE_ADD_FEEDBACK_GUIDE),
          );
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_VIEW_FEEDBACK": {
          appendImplementationTaskListAiMessage(
            buildReviewStageViewFeedbackMessage({
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
            }),
          );
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION": {
          const pid = projectId.trim();
          const board = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: parsedRequirementsState,
          });
          if (!board) {
            const message = "구현 작업 보드가 없어 보완 요청을 등록할 수 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const active = getActiveReviewFeedbackItems(
            parsedRequirementsState.reviewStageUserFeedbackListV1,
          );
          const feedback = active[0];
          if (!feedback) {
            const message = "구현단계로 전환할 미처리 피드백이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const fallbackTaskId =
            pickFirstExecutableDeveloperTaskId(board) ??
            board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId ??
            "";
          if (!fallbackTaskId) {
            const message = "보완 요청을 연결할 developer 작업이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const feedbackList = parsedRequirementsState.reviewStageUserFeedbackListV1;
          if (!feedbackList) {
            const message = "피드백 목록이 없습니다.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const converted = convertReviewFeedbackToImplementationRework({
            feedbackList,
            boardState: parsedRequirementsState.implementationExecutionBoardStateV1,
            projectId: pid,
            feedbackId: feedback.feedbackId,
            fallbackTaskId,
          });
          const session = markReviewStageReturnedToImplementation({
            session:
              parsedRequirementsState.reviewStageUserTestSessionV1 ??
              buildInitialReviewStageUserTestSession({ projectId: pid }),
          });
          void persistChatToDb(undefined, {
            reviewStageUserFeedbackListV1: converted.feedbackList,
            implementationExecutionBoardStateV1: converted.boardState,
            reviewStageUserTestSessionV1: session,
          });
          const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: {
              ...parsedRequirementsState,
              implementationExecutionBoardStateV1: converted.boardState,
              reviewStageUserFeedbackListV1: converted.feedbackList,
              reviewStageUserTestSessionV1: session,
            },
          });
          if (nextBoard) {
            appendImplementationTaskListAiMessage(
              buildImplementationExecutionBoardMessage({
                board: nextBoard,
                nowIso: new Date().toISOString(),
                previewReady: prototypeRunSyncSnapshot.previewReady,
                executionSetup: executionSetupRow,
              }),
            );
          }
          const notice = buildReviewFeedbackConvertNotice({
            feedbackId: converted.feedbackId,
            targetTaskId: converted.targetTaskId,
            reworkRequestId: converted.reworkRequestId,
          });
          appendAiNoticeForImplementation(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_COMPLETE_TEST": {
          const completeGate = canCompleteReviewStage({
            feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
          });
          if (!completeGate.ok) {
            showToast(completeGate.message);
            return { outcome: "blocked", message: completeGate.message };
          }
          const session = parsedRequirementsState.reviewStageUserTestSessionV1;
          if (!session) {
            const message = "사용자 테스트 세션이 없습니다. 먼저 사용자 테스트를 시작해 주세요.";
            showToast(message);
            return { outcome: "blocked", message };
          }
          const completed = markReviewStageUserTestCompleted({ session });
          void persistChatToDb(undefined, { reviewStageUserTestSessionV1: completed });
          appendImplementationTaskListAiMessage(
            buildReviewStageEntryMessage({
              entryReady: true,
              implementationReviewStageReadyV1: parsedRequirementsState.implementationReviewStageReadyV1,
              previewReady: prototypeRunSyncSnapshot.previewReady,
              session: completed,
              feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
              previewUrl: previewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? undefined,
            }),
          );
          const notice = "프로토타입 사용자 테스트 검토를 완료했습니다.";
          appendAiNoticeForImplementation(notice);
          showToast(notice);
          return { outcome: "executed" };
        }
        case "RUN_REFACTOR_COMMON":
          return runIntegratedStageStep("refactor_common");
        case "RUN_INTEGRATED_REVIEW":
          return runIntegratedStageStep("integrated_review");
        case "RUN_INTEGRATED_SECURITY":
          return runIntegratedStageStep("integrated_security");
        case "RUN_FINAL_SCM":
          return runFinalScmIntegratedStageStep();
        case "RUN_PLATFORM_SCM_MERGE":
          return runPlatformScmMergeStep();
        default:
          return { outcome: "blocked", message: "지원하지 않는 구현단계 action입니다." };
      }
    },
    [
      applyImplementationStageActionExecutionResult,
      refreshExecutionEnvironmentStatus,
      generateImplementationTaskList,
      confirmQuickDesignForImplementation,
      createImplementationSeedFromQuickDesignDraft,
      generateImplementationWorkPlanDraft,
      confirmImplementationTaskPlan,
      reviewDbIntegrationNeed,
      generateDataModelDraft,
      confirmMockImplementationMode,
      implementationCursorGate,
      executionSingleChat,
      wipChipHandlers,
      runImplementationQualityGate,
      runIntegratedStageStep,
      runFinalScmIntegratedStageStep,
      runPlatformScmMergeStep,
      appendImplementationTaskListAiMessage,
      chatInputRef,
      parsedRequirementsState,
      pendingImplementationPatch,
      orchestrationAwareRequirementsState,
      projectId,
      requirementsStateJson,
      effectiveImplementationState,
      executionSetupRow,
      persistChatToDb,
      showToast,
      executionArtifacts,
      prototypeRunSyncSnapshot,
    ],
  );

  const autoRefineOnceRef = useRef(false);
  useEffect(() => {
    if (autoRefineOnceRef.current) return;
    if (autoRefineImplementationPrep !== true) return;
    autoRefineOnceRef.current = true;

    const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
    const wipStatus = String(wip?.status ?? "").trim();
    const activeStatuses = new Set([
      "requested",
      "drafting",
      "refactoring",
      "wip_committed",
      "developer_reviewing",
      "refactor_requested",
      "wip_updated",
    ]);
    if (wip && activeStatuses.has(wipStatus)) {
      showToast("실행 중에는 구현준비 산출물을 다시 정제할 수 없습니다.");
      return;
    }

    const pid = projectId.trim();
    const seed = parsedRequirementsState.implementationSeedV1;
    void (async () => {
      const { res, json } = await postImplementationPrepSync(pid, {
        seed,
        existingTaskList: parsedRequirementsState.implementationTaskListV1,
        existingCodeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1,
        existingExecutionState: parsedRequirementsState.implementationTaskExecutionStateV1,
        existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
        existingPreflightSummary: parsedRequirementsState.implementationWorkItemPreflightSummaryV1,
        existingQualityGate: parsedRequirementsState.implementationCodeTaskQualityGateV1,
        priorTimeline: parsedRequirementsState.promptTimeline,
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: parsedRequirementsState.artifactOrchestrationV1,
        envOk: canRequestGeneration.envOk,
        designOk: effectiveImplementationState.designOk,
        previewReady: prototypeRunSyncSnapshot.previewReady,
        forceRefresh: true,
        forceLlm: true,
      });
      const result = json.data;
      if (!res.ok || !json.success || !result?.ok) {
        showToast(json.message || result?.message || "구현준비 산출물 재정제에 실패했습니다.");
        return;
      }
      void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), result.patch);
      for (const message of result.messages) {
        appendImplementationTaskListAiMessage(message);
      }
      showToast("구현준비 산출물을 다시 정제했습니다.");
    })();
  }, [
    autoRefineImplementationPrep,
    orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    projectId,
    parsedRequirementsState,
    executionArtifacts,
    canRequestGeneration.envOk,
    effectiveImplementationState.designOk,
    prototypeRunSyncSnapshot.previewReady,
    executionSetupRow,
    persistChatToDb,
    requirementsStateJson,
    appendImplementationTaskListAiMessage,
    showToast,
  ]);

  const executeImplementationStageAction = useCallback(
    (
      actionId: ImplementationStageActionId,
      clickContext?: {
        readonly label: string;
        readonly source: ImplementationStageActionClickSource;
        readonly buttonIndex?: number;
      },
    ): boolean => {
      const pid = projectId.trim();
      if (!pid) {
        showToast("프로젝트를 선택해 주세요.");
        return true;
      }

      const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
      const resolvedActionId = clickContext
        ? resolveImplementationStageActionClick({
            actionId,
            label: clickContext.label,
            wip,
          })
        : actionId;

      if (clickContext) {
        persistStageActionTimelineEntries([
          buildImplementationStageActionClickedTimelineEntry({
            actionId: resolvedActionId,
            label: clickContext.label,
            source: clickContext.source,
            buttonIndex: clickContext.buttonIndex,
            selectedTaskId: wip?.selectedTaskId,
            currentBridgeExecutionStatus: wip?.bridgeExecutionStatus,
            currentExecutionMode: wip?.executionMode,
          }),
        ]);
      }

      void orchestrateImplementationStageAction({
        projectId: pid,
        actionId: resolvedActionId,
        source: "cta",
        effectiveState: effectiveImplementationState,
        boardGateContext: implementationStageBoardGateContext,
        execute: () => runImplementationStageAction(resolvedActionId),
      }).then((run) => {
        persistImplementationStageActionRun(run);
        const gateBlocked = run.gateResult != null && !run.gateResult.ok;
        if (gateBlocked && run.message) {
          showToast(run.message);
        } else if (run.status === "failed" && run.message) {
          showToast(run.message);
        }
      });

      return true;
    },
    [
      projectId,
      effectiveImplementationState,
      implementationStageBoardGateContext,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      runImplementationStageAction,
      persistImplementationStageActionRun,
      persistStageActionTimelineEntries,
      showToast,
    ],
  );

  const handleRestartBoardTask = useCallback(
    (taskId: string) => {
      const pid = projectId.trim();
      const board = implementationStageBoardGateContext?.board;
      if (!pid || !board) {
        showToast("구현 Execution Board가 준비되지 않았습니다.");
        return;
      }
      const row = board.taskRows.find((item) => item.taskId === taskId);
      if (!row) {
        showToast(`${taskId} Task를 찾을 수 없습니다.`);
        return;
      }
      const taskCursorExecution =
        parseTaskCursorExecutionV1(orchestrationAwareRequirementsState.taskCursorExecutionV1) ?? null;
      const capability = resolveTaskRowUserRestartCapability({
        row,
        board,
        taskCursorExecution,
      });
      if (!capability.canRestart) {
        showToast(capability.blockedReason ?? "이 Task는 지금 실행할 수 없습니다.");
        return;
      }
      const envGate = resolveTaskCursorExecutionEnvGate({ setup: executionSetupRow });
      if (envGate.blocked) {
        showToast(envGate.message ?? "환경설정 점검이 필요합니다.");
        appendAiNoticeForImplementation(envGate.message ?? "환경설정 점검이 필요합니다.");
        return;
      }

      if (capability.needsReworkRegistration) {
        const nowIso = new Date().toISOString();
        const nextBoardState = appendReworkRequest({
          state: parsedRequirementsState.implementationExecutionBoardStateV1,
          projectId: pid,
          taskId,
          targetRole: "developer",
          reason: "사용자 재작업 요청: 선택 Task 재시작",
          nowIso,
        });
        applyImplementationOrchestrationResult({
          messages: executionSingleChat.chatMessages,
          orchestrationPatch: {
            implementationExecutionBoardStateV1: nextBoardState,
          },
        });
        const notice = buildReworkRequestRegistrationNotice({ board, taskId });
        appendAiNoticeForImplementation(notice);
        showToast(`${taskId} · 재작업 등록 후 실행합니다.`);
      }

      boardManualPickTaskIdRef.current = taskId;
      void orchestrateImplementationStageAction({
        projectId: pid,
        actionId: "REQUEST_TASK_CURSOR_EXECUTION",
        source: "cta",
        effectiveState: effectiveImplementationState,
        boardGateContext: implementationStageBoardGateContext,
        execute: () => runImplementationStageActionRef.current("REQUEST_TASK_CURSOR_EXECUTION"),
      }).then((run) => {
        persistImplementationStageActionRun(run);
        if (run.status === "failed" && run.message) {
          showToast(run.message);
        }
      });
    },
    [
      projectId,
      implementationStageBoardGateContext,
      orchestrationAwareRequirementsState.taskCursorExecutionV1,
      parsedRequirementsState.implementationExecutionBoardStateV1,
      executionSetupRow,
      applyImplementationOrchestrationResult,
      executionSingleChat,
      showToast,
      effectiveImplementationState,
      persistImplementationStageActionRun,
    ],
  );

  const handleBoardSelectedTaskIdsChange = useCallback(
    (selectedTaskIds: readonly string[]) => {
      const pid = projectId.trim();
      if (!pid) return;
      const nowIso = new Date().toISOString();
      const nextBoardState = updateBoardSelectedTaskIds({
        state: parsedRequirementsState.implementationExecutionBoardStateV1,
        projectId: pid,
        selectedTaskIds,
        nowIso,
      });
      applyImplementationOrchestrationResult({
        messages: executionSingleChat.chatMessages,
        orchestrationPatch: {
          implementationExecutionBoardStateV1: nextBoardState,
        },
      });
    },
    [
      projectId,
      parsedRequirementsState.implementationExecutionBoardStateV1,
      applyImplementationOrchestrationResult,
      executionSingleChat.chatMessages,
    ],
  );

  const handleBoardSelectedCodeTaskIdsChange = useCallback(
    (selectedCodeTaskIds: readonly string[]) => {
      const pid = projectId.trim();
      if (!pid) return;
      const nowIso = new Date().toISOString();
      const nextBoardState = updateBoardSelectedCodeTaskIds({
        state: parsedRequirementsState.implementationExecutionBoardStateV1,
        projectId: pid,
        selectedCodeTaskIds,
        nowIso,
      });
      applyImplementationOrchestrationResult({
        messages: executionSingleChat.chatMessages,
        orchestrationPatch: {
          implementationExecutionBoardStateV1: nextBoardState,
        },
      });
    },
    [
      projectId,
      parsedRequirementsState.implementationExecutionBoardStateV1,
      applyImplementationOrchestrationResult,
      executionSingleChat.chatMessages,
    ],
  );

  const handleImplementationBoardAction = useCallback(
    (input: ImplementationStageActionClickInput) => {
      executeImplementationStageAction(input.actionId, {
        label: input.label,
        source: input.source,
        buttonIndex: input.buttonIndex,
      });
    },
    [executeImplementationStageAction],
  );

  useEffect(() => {
    runImplementationStageActionRef.current = runImplementationStageAction;
    persistImplementationStageActionRunRef.current = persistImplementationStageActionRun;
  }, [runImplementationStageAction, persistImplementationStageActionRun]);

  const handleImplementationChip = useCallback(
    (label: string) => {
      const taskList = parsedRequirementsState.implementationTaskListV1 ?? null;
      const chipHandled = tryHandleImplementationTaskListChip({
          label,
          projectId,
          taskList,
          executionState: parsedRequirementsState.implementationTaskExecutionStateV1,
          integratedExecutionState: parsedRequirementsState.implementationIntegratedExecutionStateV1,
          boardState: parsedRequirementsState.implementationExecutionBoardStateV1,
          qualityGateResults: parsedRequirementsState.implementationQualityGateResultsV1,
          prototypeSnapshot: prototypeRunSyncSnapshot,
          envOk: canRequestGeneration.envOk,
          appendAiMessage: appendImplementationTaskListAiMessage,
          openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
          openArtifactHub: () => setArtifactHubOpen(true),
          openPrototypePreview: () => {
            const url = previewUrl ?? prototypeRunSyncSnapshot.previewUrl;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            else showToast("Preview URL이 아직 없습니다.");
          },
          returnToPlanningStage: () => {
            const pid = projectId.trim();
            if (!pid) return;
            window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
          },
          generateTaskListFromSeed: () => {
            void generateImplementationTaskList();
          },
          showToast,
        });

      if (chipHandled) {
        if (
          label.trim() === AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP &&
          taskList?.tasks?.length &&
          (!parsedRequirementsState.cursorWorkItemsV1 || parsedRequirementsState.cursorWorkItemsV1.length === 0)
        ) {
          void generateImplementationTaskList();
        }
        return true;
      }

      if (
        label.trim() === IMPLEMENTATION_GENERATION_REQUEST_CHIP &&
        taskList?.tasks?.length &&
        (!parsedRequirementsState.cursorWorkItemsV1 || parsedRequirementsState.cursorWorkItemsV1.length === 0)
      ) {
        void generateImplementationTaskList();
      }

      const actionId = mapImplementationChipToAction(label);
      if (actionId && executeImplementationStageAction(actionId, { label, source: "chat_chip" })) return true;

      return tryHandlePrototypeExecutionChip(label, {
        openEnvSettings: () => setExecutionEnvironmentModalOpen(true),
        openArtifactHub: () => setArtifactHubOpen(true),
        showImplementationSeedReadinessCheck,
        returnToPlanningStage: () => {
          const pid = projectId.trim();
          if (!pid) return;
          window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
        },
        focusComposerForScopeEdit: () => {
          showToast("아래 입력란에 수정·범위 조정 요청을 적고 전송해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
        },
        showRoleCheckDetails,
        showScmCheckDetails: () => appendStatusQueryFromChip("scm_check_details"),
        showEnvironmentCheckDetails: () => appendStatusQueryFromChip("environment_check_details"),
        generateImplementationWorkPlanDraft,
        confirmImplementationTaskPlan,
        reviewDbIntegrationNeed,
        generateDataModelDraft,
        confirmMockImplementationMode,
        ...wipChipHandlers,
        prepareImplementationExecution: () => {
          const toast = buildPrepareImplementationExecutionToast(
            effectiveImplementationState.implementationTaskPlanV1,
          );
          if (toast) showToast(toast);
        },
        confirmExecution: () => confirmExecution(),
        refreshStatus: () => void onRefreshPrototypeStatus(),
        showToast,
        canConfirmImplementationTaskPlan: () => {
          const gate = canConfirmImplementationWorkPlanFromEffectiveState(effectiveImplementationState);
          if (!gate.ok) {
            showToast(gate.message);
            return false;
          }
          return true;
        },
        canRequestCodeAgentWipWork: () => {
          const gate = evaluateImplementationCursorGate(implementationCursorGate);
          if (!gate.allowed) {
            appendAiNoticeForImplementation(formatImplementationCursorBlockedNotice(implementationCursorGate));
            return false;
          }
          return true;
        },
        canConfirmExecution: () => {
          if (!effectiveImplementationState.envOk || !effectiveImplementationState.designOk) {
            showToast("환경·설계 준비가 완료된 뒤 구현 실행을 진행할 수 있습니다.");
            return false;
          }
          return true;
        },
      });
    },
    [
      executeImplementationStageAction,
      parsedRequirementsState.implementationTaskListV1,
      parsedRequirementsState.implementationTaskExecutionStateV1,
      parsedRequirementsState.implementationQualityGateResultsV1,
      parsedRequirementsState.implementationSeedV1,
      prototypeRunSyncSnapshot,
      previewUrl,
      projectId,
      requirementsStateJson,
      persistChatToDb,
      canRequestGeneration.envOk,
      appendImplementationTaskListAiMessage,
      envSettingsHref,
      showImplementationSeedReadinessCheck,
      showRoleCheckDetails,
      appendStatusQueryFromChip,
      confirmImplementationTaskPlan,
      generateImplementationWorkPlanDraft,
      reviewDbIntegrationNeed,
      generateDataModelDraft,
      confirmMockImplementationMode,
      effectiveImplementationState,
      wipChipHandlers,
      implementationCursorGate,
      confirmExecution,
      onRefreshPrototypeStatus,
      executionSingleChat,
      showToast,
    ],
  );

  const handleArtifactBoardAction = useCallback(
    (action: ArtifactBoardAction) => {
      setArtifactHubOpen(false);
      switch (action) {
        case "go_to_implementation":
        case "generate_implementation_seed":
          showToast("아래 구현 대화에서 구현 준비정보·작업안을 이어서 진행해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
          return;
        case "generate_implementation_work_plan":
          generateImplementationWorkPlanDraft();
          return;
        case "generate_code_agent_instruction":
          handleImplementationChip(CODE_AGENT_WIP_WORK_REQUEST_CHIP);
          return;
        case "review_db_integration":
          handleImplementationChip(DB_INTEGRATION_REVIEW_CHIP);
          return;
        default:
          return;
      }
    },
    [generateImplementationWorkPlanDraft, handleImplementationChip, showToast],
  );

  useEffect(() => {
    const run = latestRun;
    if (!run?.id) return;
    const units = [...(run.workUnits ?? [])].sort((a, b) => a.order - b.order);
    const snap = JSON.stringify({
      id: run.id,
      st: run.status,
      u: units.map((u) => [u.order, u.status]),
      pv: String(run.previewUrl ?? "").trim(),
      planner: run.plannerStatus ?? "",
    });
    if (snap === lastTimelineSnapRef.current) return;
    lastTimelineSnapRef.current = snap;

    setTimelineCards((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      const additions: PrototypeWorkspaceTimelineCardV1[] = [];
      const rid = run.id;
      const now = Date.now();

      if (units.length > 0) {
        const planHash = units.map((u) => `${u.order}:${u.title}`).join("|").slice(0, 400);
        const planId = `plan-${rid}-${planHash}`;
        if (!ids.has(planId)) {
          ids.add(planId);
          additions.push({
            id: planId,
            at: now,
            runId: rid,
            kind: "plan_ready",
            title: "작업계획이 생성되었습니다.",
            body: `총 ${units.length}개의 작업으로 구성했습니다.`,
            workUnitTitlesJson: JSON.stringify(units.map((u) => ({ order: u.order, title: u.title }))),
          });
        }
      }

      for (const u of units) {
        if (u.status !== "MERGED") continue;
        const wid = `wu-${u.order}-${rid}-merged`;
        if (ids.has(wid)) continue;
        ids.add(wid);
        additions.push({
          id: wid,
          at: now,
          runId: rid,
          kind: "workunit_merged",
          title: `작업 ${u.order} 완료`,
          body: u.title,
          workUnitOrder: u.order,
          prUrl: u.prUrl?.trim() ? u.prUrl.trim() : null,
        });
      }

      if (!additions.length) return prev;
      return [...prev, ...additions].slice(-300);
    });
  }, [latestRun]);

  const handleChatIntent = useCallback(
    (a: PrototypeChatAction) => {
      switch (a.intent) {
        case "OPEN_ENV_SETTINGS":
          setExecutionEnvironmentModalOpen(true);
          return;
        case "OPEN_TEMPLATE_PREVIEW":
          setTemplatePreviewOpen(true);
          return;
        case "SELECT_TEMPLATE_RECOMMENDED":
          applyChatTemplateIntent(null);
          return;
        case "SELECT_TEMPLATE":
          if (a.templateId) applyChatTemplateIntent(a.templateId as PrototypeTemplateType);
          return;
        case "CREATE_PLAN":
          startWorkPlanGenerationFromChat();
          return;
        case "OPEN_PLANNER_PROMPT_IN_CHAT": {
          if (!templatePlanningReady) return;
          if (plannerCreatePending || isPlannerRunning || protoBusy) return;
          setPlannerPromptModalOpen(true);
          return;
        }
        case "START_WORK_PLAN_GENERATION":
          startWorkPlanGenerationFromChat();
          return;
        case "RETRY_PLANNER_GENERATION":
          startWorkPlanGenerationFromChat();
          return;
        case "REFRESH_STATUS":
          void onRefreshPrototypeStatus();
          return;
        case "CONFIRM_EXECUTION":
          confirmExecution();
          return;
        case "REGENERATE_PLAN":
          void regeneratePlan();
          return;
        case "MODIFY_REQUEST":
          showToast("아래 입력란에 수정 요청을 적고 전송해 주세요.");
          queueMicrotask(() => chatInputRef.current?.focus());
          return;
        case "CANCEL_RUN":
          setCancelConfirmOpen(true);
          return;
        case "RESUME_RUN": {
          const rid = latestRun?.id;
          if (!rid) return;
          void (async () => {
            setProtoBusy(true);
            try {
              const r = await postPrototypeRunResume(rid, { projectId, mode: "resume" });
              if (r.success && r.data?.run) setLatestRun(r.data.run);
              if (r.message) showToast(r.message);
            } finally {
              setProtoBusy(false);
              void refreshLatestRun();
            }
          })();
          return;
        }
        case "RESTART_RUN": {
          const rid = latestRun?.id;
          if (!rid) return;
          void (async () => {
            setProtoBusy(true);
            try {
              const r = await postPrototypeRunResume(rid, { projectId, mode: "restart" });
              if (r.success && r.data?.run) setLatestRun(r.data.run);
              if (r.message) showToast(r.message);
            } finally {
              setProtoBusy(false);
              void refreshLatestRun();
            }
          })();
          return;
        }
        case "RETRY_FAILED_WU": {
          const rid = latestRun?.id;
          const ord = a.workUnitOrder;
          if (!rid || typeof ord !== "number") return;
          retryWorkUnit("same_prompt")(rid, ord);
          return;
        }
        case "OPEN_ACTIONS_URL": {
          const u = latestRun?.pagesDeployWorkflowRunUrl?.trim();
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "OPEN_PR_URL": {
          const ord = a.workUnitOrder;
          if (typeof ord !== "number") return;
          const wu = sortedWorkUnitsForSidebar.find((x) => x.order === ord);
          const u = wu?.prUrl?.trim();
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "OPEN_PREVIEW": {
          const u = previewUrl ?? latestRun?.previewUrl ?? latestRun?.suggestedPreviewUrl ?? "";
          if (u) {
            const win = window.open(u, "_blank", "noopener,noreferrer");
            registerPlatformPopupFromOpenedUrl(win, u);
          }
          return;
        }
        case "COPY_PREVIEW_URL": {
          const u = previewUrl ?? latestRun?.previewUrl ?? latestRun?.suggestedPreviewUrl ?? "";
          if (!u) return;
          void navigator.clipboard?.writeText(u).catch(() => {});
          showToast("URL을 복사했습니다.");
          return;
        }
        case "OPEN_PROTOTYPE_REVIEW": {
          const rid = latestRun?.id;
          if (!projectId.trim() || !rid) return;
          window.location.assign(
            `/prototype-review?${new URLSearchParams({ projectId: projectId.trim(), runId: rid }).toString()}`,
          );
          return;
        }
        default:
          return;
      }
    },
    [
      envSettingsHref,
      applyChatTemplateIntent,
      startWorkPlanGenerationFromChat,
      canRequestGeneration.designOk,
      templatePlanningReady,
      protoBusy,
      plannerCreatePending,
      isPlannerRunning,
      showToast,
      confirmExecution,
      regeneratePlan,
      latestRun?.id,
      latestRun?.pagesDeployWorkflowRunUrl,
      latestRun?.previewUrl,
      projectId,
      refreshLatestRun,
      retryWorkUnit,
      sortedWorkUnitsForSidebar,
      previewUrl,
    ],
  );

  const isWorkPlanPlanningUi = isPlannerRunning || plannerCreatePending;

  const executionActivityStatus = useMemo(
    () =>
      resolvePrototypeExecutionActivityStatus({
        implementationResetBusy,
        executionAiSummaryBusy,
        plannerCreatePending,
        isPlannerRunning,
        plannerProgressStep,
        isRunningState,
        latestRunStatus: latestRun?.status ?? null,
        protoBusy,
        executionEnvLoading: envCheckInFlight,
        conversationLoading: executionSingleChat.conversationStatus !== "loaded",
        aiInvokePending: executionSingleChat.aiInvokePending,
        codeAgentWipExecutionV1: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      }),
    [
      implementationResetBusy,
      executionAiSummaryBusy,
      plannerCreatePending,
      isPlannerRunning,
      plannerProgressStep,
      isRunningState,
      latestRun?.status,
      protoBusy,
      envCheckInFlight,
      executionSingleChat.conversationStatus,
      executionSingleChat.aiInvokePending,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    ],
  );

  const chatPlaceholder = useMemo(() => {
    if (isWorkPlanPlanningUi) {
      return `${prototypeAiTitle}가 작업계획을 생성 중입니다.`;
    }
    if (isMessageInputBlocked) {
      return `${prototypeAiTitle}가 작업 중입니다. 잠시 기다려주세요.`;
    }
    if (isDraftGenerationComplete) {
      return "완료된 실행입니다. 새로 시작하려면 타임라인의 「처음부터 다시 생성」을 이용해 주세요.";
    }
    if (isRunningState) {
      return "실행 중에는 작업계획을 수정할 수 없습니다.";
    }
    if (latestRun?.id && latestRun.status === "WORK_UNITS_READY" && latestRun.workUnitsExecutionConfirmed !== true) {
      return "수정 요청을 입력한 뒤 전송하면 작업계획을 다시 만듭니다.";
    }
    if (
      templatePlanningReady &&
      (!latestRun?.id || (latestRun.workUnits?.length ?? 0) === 0) &&
      !isWorkPlanPlanningUi
    ) {
      return "작업계획 생성 전 추가 지시가 있으면 입력 후 전송하세요.";
    }
    return "메시지를 입력하세요.";
  }, [
    prototypeAiTitle,
    templatePlanningReady,
    isWorkPlanPlanningUi,
    isMessageInputBlocked,
    isRunningState,
    latestRun?.id,
    latestRun?.status,
    latestRun?.workUnits?.length,
    latestRun?.workUnitsExecutionConfirmed,
    isDraftGenerationComplete,
  ]);

  const prototypeModalParticipants = useMemo((): readonly ParticipantOption[] => {
    const aiStatus = isPlannerRunning
      ? "작업계획 생성 중"
      : isRunningState
        ? "자동화 진행 중"
        : isDraftGenerationComplete || (latestRun?.status === "PREVIEW_READY" && String(latestRun?.publicUrl ?? "").trim())
          ? "초안 완료"
          : latestRun?.status === "DEPLOY_FAILED" || latestRun?.status === "FAILED"
            ? "오류"
            : "대기";
    const memberIds = [...IMPLEMENTATION_MODE_PRIMARY_MEMBERS];
    const platformAi = buildWorkspaceAiParticipantOptions({
      currentMemberIds: memberIds,
      statusLabelForCurrent: aiStatus,
    });
    return [
      ...platformAi,
      {
        id: "prototype-user-self",
        name: "사용자",
        kind: "human",
        onlineHint: true,
        roleLabel: "OWNER",
      },
    ];
  }, [
    isPlannerRunning,
    isRunningState,
    isDraftGenerationComplete,
    latestRun?.status,
    latestRun?.publicUrl,
  ]);

  const implementationParticipantCount = useMemo(
    () => Math.max(prototypeModalParticipants.length, IMPLEMENTATION_MODE_PARTICIPANT_COUNT),
    [prototypeModalParticipants],
  );

  const planningOrchestrationView = useMemo(
    () =>
      buildPrototypeExecutionPlanningOrchestrationView({
        requirementsStateJson,
        projectId,
        projectName: projectName || "프로젝트",
        projectDescription,
        servicePlanningAgentCatalogKeys: prototypeScreenCatalogIds,
      }),
    [requirementsStateJson, projectId, projectName, projectDescription, prototypeScreenCatalogIds],
  );

  const deliverableViewerAssets = useMemo(() => {
    const pid = projectId.trim();
    const ids = planningOrchestrationView.deliverableViewerAssetIds;
    const fromDeliverables = planningOrchestrationView.deliverableAssets.filter((a) => ids.includes(a.id));
    const knownIds = new Set(fromDeliverables.map((a) => a.id));
    const extras = ids.flatMap((id) => {
      if (knownIds.has(id)) return [];
      const artifact = planningOrchestrationView.projectArtifacts.find((a) => a.id === id);
      if (!artifact || !pid) return [];
      return [projectArtifactToDeliverableAsset(artifact, pid)];
    });
    const byId = new Map<string, import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset>();
    for (const a of [...fromDeliverables, ...extras, ...viewerDerivedAssets]) {
      byId.set(a.id, a);
    }
    return [...byId.values()];
  }, [planningOrchestrationView, projectId, viewerDerivedAssets]);

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerIds([...ids]);
    setDeliverableViewerFocusId(focusId ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const implementationArtifactHubView = useMemo(
    () =>
      buildArtifactHubBundle({
        mode: "implementation",
        state: parsedRequirementsState,
        projectId: projectId.trim(),
        deliverableAssets: planningOrchestrationView.deliverableAssets,
        projectArtifacts: planningOrchestrationView.projectArtifacts,
      }).view,
    [
      parsedRequirementsState,
      projectId,
      planningOrchestrationView.deliverableAssets,
      planningOrchestrationView.projectArtifacts,
    ],
  );

  const {
    open: recommendationPanelOpen,
    items: recommendationEvidenceItems,
    close: closeRecommendationPanel,
  } = useProjectRecommendationEvidence({
    projectId,
    requirementsStateJson: parsedRequirementsState,
    messages: executionSingleChat.chatMessages,
    projectArtifacts: planningOrchestrationView.projectArtifacts,
    projectDescription,
  });

  const artifactHubOpenedRef = useRef(false);
  useEffect(() => {
    if (!artifactHubOpen) {
      artifactHubOpenedRef.current = false;
      return;
    }
    if (artifactHubOpenedRef.current) return;
    artifactHubOpenedRef.current = true;
    const timeline = appendPromptTimeline(
      parsedRequirementsState.promptTimeline,
      buildImplementationArtifactsTimelineEntry({
        action: "implementation_artifact_hub_opened",
        implementationArtifactCount: implementationArtifactHubView.implementationPrimary.length,
        planningReferenceCount: implementationArtifactHubView.planningReference.length,
        types: implementationArtifactHubView.derivedTypes,
      }),
    );
    void persistChatToDb(undefined, { promptTimeline: timeline });
  }, [artifactHubOpen, implementationArtifactHubView, parsedRequirementsState.promptTimeline, persistChatToDb]);

  const handleArtifactHubSelect = useCallback(
    (entry: ProjectArtifactHubEntry) => {
      const pid = projectId.trim();
      const derived = derivedHubEntryToDeliverableAsset(entry, pid);
      if (derived) {
        setViewerDerivedAssets((prev) => (prev.some((a) => a.id === derived.id) ? prev : [...prev, derived]));
        openDeliverableViewer([derived.id], derived.id);
        const timeline = appendPromptTimeline(
          parsedRequirementsState.promptTimeline,
          buildImplementationArtifactsTimelineEntry({
            action: "implementation_artifact_viewed",
            implementationArtifactCount: implementationArtifactHubView.implementationPrimary.length,
            planningReferenceCount: implementationArtifactHubView.planningReference.length,
            types: implementationArtifactHubView.derivedTypes,
            viewedType: entry.implementationArtifactType ?? entry.title,
          }),
        );
        void persistChatToDb(undefined, { promptTimeline: timeline });
        return;
      }
      const ids = planningOrchestrationView.deliverableViewerAssetIds.length
        ? planningOrchestrationView.deliverableViewerAssetIds
        : [entry.assetId];
      openDeliverableViewer(ids, entry.assetId);
    },
    [
      projectId,
      openDeliverableViewer,
      planningOrchestrationView.deliverableViewerAssetIds,
      parsedRequirementsState.promptTimeline,
      implementationArtifactHubView,
      persistChatToDb,
    ],
  );

  const startImplementationQuickRun = useCallback(async (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }): Promise<ImplementationStageActionRunResult> => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트 ID가 없습니다." };
    const imp = orchestrationAwareRequirementsStateRef.current;
    const prep = prepareSelectedCodeTaskIdsForQuickRun({
      codeTaskPlan: imp.implementationCodeTaskPlanV1,
      selectedCodeTaskIds:
        options?.selectedCodeTaskIds ??
        imp.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
      legacySelectedTaskIds: imp.implementationExecutionBoardStateV1?.selectedTaskIds,
    });
    if (prep.status === "blocked") {
      const toastMessage =
        prep.message.split("\n")[0]?.trim() ?? QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE;
      const nowIso = new Date().toISOString();
      recordQuickRunClientEvent({
        phase: "quick_run_selected_mock_id_blocked",
        detail: prep.message,
        toastMessage,
        selectedCount: 0,
      });
      const blockedEntry = buildImplementationExecutionLogTimelineEntry({
        action: "quick_run_selected_mock_id_blocked",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { projectId: pid, codeTaskId: prep.codeTaskId },
        nowIso,
      });
      const blockedTimeline = appendPromptTimeline(imp.promptTimeline, blockedEntry);
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline: blockedTimeline });
      void persistChatToDb(undefined, { promptTimeline: blockedTimeline }, undefined, { force: true });
      return { outcome: "blocked", message: toastMessage };
    }
    if (prep.repairs.length) {
      const nowIso = new Date().toISOString();
      let repairTimeline = imp.promptTimeline;
      for (const repair of prep.repairs) {
        repairTimeline = appendPromptTimeline(
          repairTimeline,
          buildImplementationExecutionLogTimelineEntry({
            action: "quick_run_selected_mock_id_repaired",
            orchestrationTraceGroup: "implementation_orchestration",
            fields: {
              projectId: pid,
              fromCodeTaskId: repair.fromCodeTaskId,
              toCodeTaskId: repair.toCodeTaskId,
            },
            nowIso,
          }),
        );
      }
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline: repairTimeline });
      void persistChatToDb(undefined, { promptTimeline: repairTimeline }, undefined, { force: true });
    }
    const executionGate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: prep.selectedCodeTaskIds,
      codeTasks: imp.implementationCodeTaskPlanV1?.tasks ?? [],
      units: loadImplementationExecutionUnitsFromState(imp),
      runs: parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [],
    });
    if (!executionGate.ok) {
      const message =
        executionGate.message ?? "선택한 CodeTask 중 현재 실행할 수 있는 작업이 없습니다.";
      recordQuickRunClientEvent({
        phase: "blocked_no_runnable_selection",
        detail: message,
        toastMessage: message,
        selectedCount: prep.selectedCodeTaskIds.length,
      });
      return { outcome: "blocked", message };
    }
    const selectedCodeTaskIds = executionGate.runnableIds;
    recordQuickRunClientEvent({
      phase: "start_implementation_quick_run",
      detail: selectedCodeTaskIds.length
        ? `selected=${selectedCodeTaskIds.join(",")}`
        : "selected=none",
      selectedCount: selectedCodeTaskIds.length,
    });
    quickRunStuckGithubVerifyRef.current = null;
    quickRunCodeTaskContinuationRef.current = null;
    dbQueuedQuickRunDispatchRef.current = null;
    const codeTaskPlan = imp.implementationCodeTaskPlanV1;
    const nowIso = new Date().toISOString();
    let codeTaskExecutionRunsV1 =
      parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
    const jobSelectedCodeTaskIds = selectedCodeTaskIds;
    const queueItems = jobSelectedCodeTaskIds.map((codeTaskId) => {
      const target = resolveCodeTaskDispatchTarget({
        codeTaskId,
        codeTaskPlan: imp.implementationCodeTaskPlanV1,
        taskList: imp.implementationTaskListV1,
        cursorWorkItems: imp.cursorWorkItemsV1,
      });
      return {
        codeTaskId,
        parentTaskId: target?.parentTaskId ?? codeTaskId,
        workItemId: target?.workItem.id ?? null,
      };
    });
    if (typeof console !== "undefined" && console.info) {
      console.info("[quick-run] POST start_job", {
        projectId: pid,
        codeTaskCount: jobSelectedCodeTaskIds.length,
        head: jobSelectedCodeTaskIds[0],
      });
    }
    const startJobRes = await postImplementationRuntimeAction({
      projectId: pid,
      action: "start_job",
      selectedCodeTaskIds: jobSelectedCodeTaskIds,
      queueItems,
    });
    if (!startJobRes.success) {
      const message = startJobRes.message ?? "DB Runtime Job 시작에 실패했습니다.";
      recordQuickRunClientEvent({
        phase: "start_job_failed",
        detail: message,
        toastMessage: message,
        selectedCount: jobSelectedCodeTaskIds.length,
      });
      return { outcome: "blocked", message };
    }
    if (startJobRes.bundle) {
      setImplementationRuntimeDbBundle(startJobRes.bundle);
    }

    const runtimeBundle = startJobRes.bundle ?? null;
    const firstCodeTaskId =
      runtimeBundle?.job?.currentCodeTaskId?.trim() ?? jobSelectedCodeTaskIds[0]?.trim() ?? "";
    if (!runtimeBundle?.job?.id || !firstCodeTaskId) {
      const message =
        "DB Runtime Job을 시작하지 못했습니다. 마이그레이션 적용 후 다시 시도하거나 Runtime을 새로고침하세요.";
      showToast(message);
      return { outcome: "blocked", message };
    }
    const dispatchTarget = resolveCodeTaskDispatchTarget({
      codeTaskId: firstCodeTaskId,
      codeTaskPlan: imp.implementationCodeTaskPlanV1,
      taskList: imp.implementationTaskListV1,
      cursorWorkItems: imp.cursorWorkItemsV1,
    });
    if (!dispatchTarget) {
      const message = `CodeTask ${firstCodeTaskId ?? ""}에 연결된 WorkItem을 찾을 수 없습니다.`;
      showToast(message);
      return { outcome: "blocked", message };
    }
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: executionSetupRow?.gitRepoUrl,
      gitRepoName: executionSetupRow?.gitRepoName,
      gitRepoProvider: executionSetupRow?.gitRepoProvider,
      baseBranch: executionSetupRow?.baseBranch,
    });
    const developerPrompt = targetRepository
      ? (() => {
          const promptContext = getCodeTaskPromptContextFromMap(
            imp.codeTaskPromptContextMapV1,
            dispatchTarget.codeTask.codeTaskId,
          );
          const built = buildCodeTaskDeveloperPromptDetailed({
            codeTask: dispatchTarget.codeTask,
            parentTask: dispatchTarget.parentTask,
            promptContext,
            targetRepository,
            baseBranch: executionSetupRow?.baseBranch ?? "main",
            allowedPathGlobs: parseStringArrayJson(executionSetupRow?.allowedPathGlobs),
            targetRepoKind: "generated_project",
          }).prompt.trim();
          const copy = resolveCodeTaskDeveloperPromptForCopy({
            projectId: pid,
            codeTaskId: dispatchTarget.codeTask.codeTaskId,
            codeTaskPlan: imp.implementationCodeTaskPlanV1 ?? null,
            taskList: imp.implementationTaskListV1 ?? null,
            cursorWorkItems: imp.cursorWorkItemsV1 ?? [],
            runs: codeTaskExecutionRunsV1,
            targetRepository,
            baseBranch: executionSetupRow?.baseBranch ?? targetRepository.defaultBranch ?? "main",
            allowedPathGlobs: parseStringArrayJson(executionSetupRow?.allowedPathGlobs),
            codeTaskPromptContextMapV1: imp.codeTaskPromptContextMapV1 ?? null,
          });
          return copy.ok && copy.prompt ? copy.prompt : built || undefined;
        })()
      : undefined;
    const quickRunNextRun = createCodeTaskExecutionRun({
      projectId: pid,
      processTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      codeTaskId: dispatchTarget.codeTask.codeTaskId,
      developerPrompt,
      nowIso,
    });
    codeTaskExecutionRunsV1 = appendCodeTaskExecutionRun(codeTaskExecutionRunsV1, quickRunNextRun);
    const quickRunActiveDispatch = {
      codeTaskId: dispatchTarget.codeTask.codeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      runId: quickRunNextRun.runId,
    };
    const quickRunParentTaskIds = [
      ...new Set(
        jobSelectedCodeTaskIds
          .map(
            (codeTaskId) =>
              codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId)?.parentTaskId.trim() ?? "",
          )
          .filter(Boolean),
      ),
    ];
    const quickRun = buildImplementationQuickRunStartedPatch({
      projectId: pid,
      currentTaskId: dispatchTarget.parentTaskId,
      selectedTaskIds: quickRunParentTaskIds,
      nowIso,
    });
    const runtimeUiSnapshotPatch = buildPersistedActiveDispatchSnapshotPatch({
      projectId: pid,
      dispatch: quickRunActiveDispatch,
      baseState: {
        ...(parseRequirementsStateJson(requirementsStateJsonRef.current) as Record<string, unknown>),
        implementationQuickRunV1: quickRun,
        codeTaskExecutionRunsV1,
      },
      nowIso,
    });
    applyImplementationOrchestrationResult(
      {
        messages: executionSingleChat.chatMessages,
        orchestrationPatch: {
          implementationQuickRunV1: quickRun,
          codeTaskExecutionRunsV1,
          implementationRuntimeUiSnapshotV1: runtimeUiSnapshotPatch,
        },
      },
      { persist: false },
    );
    showToast(
      `선택 CodeTask ${jobSelectedCodeTaskIds.length}개를 순차 실행합니다. (${dispatchTarget.codeTask.codeTaskId})`,
    );
    codeTaskDispatchPreferredTaskIdRef.current = dispatchTarget.parentTaskId;
    const dbRunId = runtimeBundle.currentRun?.id?.trim() ?? "";
    if (dbRunId) {
      dbQueuedQuickRunDispatchRef.current = `${dbRunId}:${dispatchTarget.codeTask.codeTaskId}`;
    }
    void (async () => {
      try {
        let dispatchOutcome = startJobRes.quickRunDispatch?.outcome;
        let dispatchReason = startJobRes.quickRunDispatch?.reason ?? null;
        let dispatchOk = startJobRes.quickRunDispatch?.ok === true;
        let dispatchPatch = startJobRes.quickRunDispatch?.orchestrationPatch as
          | PrototypeExecutionOrchestrationPersistInput
          | undefined;

        if (!dispatchOk) {
          const res = await credentialsIncludeFetch(
            "/api/prototype/implementation-runtime/continue-quick-run",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId: pid,
                mode: "db_queued_auto_dispatch",
              }),
            },
          );
          const json = (await res.json()) as {
            success?: boolean;
            outcome?: string;
            reason?: string;
            orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
          };
          dispatchOk = json.outcome === "dispatched" || json.success === true;
          dispatchOutcome = json.outcome;
          dispatchReason = json.reason ?? null;
          dispatchPatch = json.orchestrationPatch;
        }

        if (dispatchPatch) {
          applyImplementationOrchestrationResult({
            messages: executionSingleChat.chatMessages,
            orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(dispatchPatch),
          });
        }

        await persistChatToDb(
          resolvePrototypeExecutionSingleChatFromState(requirementsStateJson),
          {
            implementationQuickRunV1: quickRun,
            codeTaskExecutionRunsV1,
            implementationRuntimeUiSnapshotV1: runtimeUiSnapshotPatch,
            promptTimeline: appendPromptTimeline(
              imp.promptTimeline,
              buildImplementationQuickRunTimelineEntry({
                action: "implementation_quick_run_started",
                projectId: pid,
                taskId: dispatchTarget.parentTaskId,
                nowIso,
              }),
            ),
          },
          undefined,
          { awaitServer: true, force: true },
        );

        if (startJobRes.bundle) {
          setImplementationRuntimeDbBundle(startJobRes.bundle);
        }
        void loadImplementationRuntimeDb({ recover: false });

        const dispatchNowIso = new Date().toISOString();
        void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
          promptTimeline: appendPromptTimeline(
            imp.promptTimeline,
            buildImplementationQuickRunCursorDispatchTimelineEntry({
              projectId: pid,
              taskId: dispatchTarget.parentTaskId,
              outcome:
                dispatchOk || dispatchOutcome === "dispatched"
                  ? "executed"
                  : dispatchOutcome === "blocked"
                    ? "blocked"
                    : "no_op",
              message: dispatchReason,
              nowIso: dispatchNowIso,
            }),
          ),
        });

        if (dispatchOk || dispatchOutcome === "dispatched") {
          showToast(`CodeTask ${dispatchTarget.codeTask.codeTaskId} Cursor 실행을 시작했습니다.`);
        } else if (dispatchReason || dispatchOutcome === "skipped") {
          showToast(
            dispatchReason != null
              ? formatQuickRunContinuationReason(dispatchReason)
              : "Cursor 자동 실행이 건너뛰어졌습니다.",
          );
          dbQueuedQuickRunDispatchRef.current = null;
        }
      } catch (error) {
        dbQueuedQuickRunDispatchRef.current = null;
        const message = error instanceof Error ? error.message : String(error);
        showToast(`Cursor 실행 시작 실패: ${message}`);
      }
    })();
    return { outcome: "executed" as const };
  }, [
    projectId,
    recordQuickRunClientEvent,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatchRef,
    enrichCodeTaskRunOrchestrationPatch,
    loadImplementationRuntimeDb,
    persistChatToDb,
    requirementsStateJson,
    executionSetupRow?.allowedPathGlobs,
    executionSetupRow?.baseBranch,
    executionSetupRow?.gitRepoName,
    executionSetupRow?.gitRepoProvider,
    executionSetupRow?.gitRepoUrl,
    executionSingleChat,
    showToast,
    formatQuickRunContinuationReason,
  ]);

  useEffect(() => {
    startImplementationQuickRunRef.current = () => {
      const imp = orchestrationAwareRequirementsStateRef.current;
      const selectedCodeTaskIds = normalizeSelectedCodeTaskIds({
        codeTaskPlan: imp.implementationCodeTaskPlanV1,
        selectedCodeTaskIds: imp.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
        legacySelectedTaskIds: imp.implementationExecutionBoardStateV1?.selectedTaskIds,
      });
      void startImplementationQuickRun({ selectedCodeTaskIds });
    };
  }, [startImplementationQuickRun]);

  const handleCopyCodeTaskCursorPrompt = useCallback(
    (codeTaskId: string) => {
      const pid = projectId.trim();
      const id = codeTaskId.trim();
      if (!pid || !id) return;
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: executionSetupRow?.gitRepoUrl,
        gitRepoName: executionSetupRow?.gitRepoName,
        gitRepoProvider: executionSetupRow?.gitRepoProvider,
        baseBranch: executionSetupRow?.baseBranch,
      });
      const runs =
        parseCodeTaskExecutionRunsV1(orchestrationAwareRequirementsState.codeTaskExecutionRunsV1) ??
        [];
      const result = resolveCodeTaskDeveloperPromptForCopy({
        projectId: pid,
        codeTaskId: id,
        codeTaskPlan: orchestrationAwareRequirementsState.implementationCodeTaskPlanV1 ?? null,
        taskList: orchestrationAwareRequirementsState.implementationTaskListV1 ?? null,
        cursorWorkItems: orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [],
        runs,
        targetRepository,
        baseBranch: executionSetupRow?.baseBranch ?? targetRepository?.defaultBranch ?? "main",
        allowedPathGlobs: parseStringArrayJson(executionSetupRow?.allowedPathGlobs),
        codeTaskPromptContextMapV1:
          orchestrationAwareRequirementsState.codeTaskPromptContextMapV1 ?? null,
      });
      if (!result.ok || !result.prompt) {
        showToast(result.reason ?? "프롬프트 생성 정보가 아직 없습니다.");
        return;
      }
      void writeClipboardText(result.prompt).then((ok) => {
        showToast(
          ok
            ? formatDeveloperPromptSingleCopySuccessToast(id)
            : "클립보드 복사에 실패했습니다.",
        );
      });
    },
    [
      projectId,
      executionSetupRow,
      orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
      orchestrationAwareRequirementsState.implementationCodeTaskPlanV1,
      orchestrationAwareRequirementsState.implementationTaskListV1,
      orchestrationAwareRequirementsState.cursorWorkItemsV1,
      orchestrationAwareRequirementsState.codeTaskPromptContextMapV1,
      showToast,
    ],
  );

  const handleCopyDeveloperPromptsFromHeader = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const imp = orchestrationAwareRequirementsState;
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: executionSetupRow?.gitRepoUrl,
      gitRepoName: executionSetupRow?.gitRepoName,
      gitRepoProvider: executionSetupRow?.gitRepoProvider,
      baseBranch: executionSetupRow?.baseBranch,
    });
    const selectedCodeTaskIds = normalizeSelectedCodeTaskIds({
      codeTaskPlan: imp.implementationCodeTaskPlanV1,
      selectedCodeTaskIds: imp.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
      legacySelectedTaskIds: imp.implementationExecutionBoardStateV1?.selectedTaskIds,
    });
    const plan = imp.implementationCodeTaskPlanV1 ?? null;
    const currentCodeTaskId = resolveExecutionTargetCodeTaskId({
      selectedCodeTaskId: null,
      runtimeCurrentCodeTaskId:
        implementationRuntimeDbBundle?.job?.currentCodeTaskId?.trim() ?? null,
      codeTaskPlan: plan ?? undefined,
    });
    const runs =
      parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
    const result = resolveDeveloperPromptCopyFromSelection({
      projectId: pid,
      selectedCodeTaskIds,
      currentCodeTaskId,
      codeTaskPlan: plan,
      taskList: imp.implementationTaskListV1 ?? null,
      cursorWorkItems: imp.cursorWorkItemsV1 ?? [],
      runs,
      targetRepository,
      baseBranch: executionSetupRow?.baseBranch ?? targetRepository?.defaultBranch ?? "main",
      allowedPathGlobs: parseStringArrayJson(executionSetupRow?.allowedPathGlobs),
      codeTaskPromptContextMapV1: imp.codeTaskPromptContextMapV1 ?? null,
    });
    if (!result.ok || !result.prompt) {
      showToast(result.reason ?? "개발 프롬프트를 복사할 수 없습니다.");
      return;
    }
    const totalCodeTaskCount = plan?.tasks?.length ?? 0;
    void writeClipboardText(result.prompt).then((ok) => {
      showToast(
        ok
          ? formatDeveloperPromptHeaderCopySuccessToast({
              count: result.count ?? 1,
              selectedCodeTaskIds,
              totalCodeTaskCount,
            })
          : "클립보드 복사에 실패했습니다.",
      );
    });
  }, [
    projectId,
    orchestrationAwareRequirementsState,
    executionSetupRow,
    implementationRuntimeDbBundle?.job?.currentCodeTaskId,
    showToast,
  ]);

  const onImplementationQuickExecution = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;

    if (protoBusy || executionAiSummaryBusy || implementationResetBusy) {
      recordQuickRunClientEvent({
        phase: "toolbar_blocked_busy",
        detail: "protoBusy 또는 요약/초기화 작업 중",
        toastMessage: "다른 작업 처리 중입니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    const imp = orchestrationAwareRequirementsStateRef.current;
    const board = implementationStageBoardGateContext?.board ?? null;
    const selectedOnBoard = normalizeSelectedCodeTaskIds({
      codeTaskPlan: imp.implementationCodeTaskPlanV1,
      selectedCodeTaskIds: imp.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
      legacySelectedTaskIds: imp.implementationExecutionBoardStateV1?.selectedTaskIds,
    });
    recordQuickRunClientEvent({
      phase: "toolbar_quick_execution",
      detail: board?.taskRows.length
        ? `boardRows=${board.taskRows.length} selected=${selectedOnBoard.length}`
        : "no_board_rows",
      selectedCount: selectedOnBoard.length,
    });
    if (board?.taskRows.length) {
      if (!selectedOnBoard.length) {
        recordQuickRunClientEvent({
          phase: "toolbar_blocked_no_selection",
          detail: "실행할 CodeTask를 선택해 주세요.",
          toastMessage: "실행할 CodeTask를 선택해 주세요.",
          selectedCount: 0,
        });
        return;
      }
      void startImplementationQuickRun({ selectedCodeTaskIds: selectedOnBoard });
      return;
    }

    const entryState = deriveImplementationEntryState({
      implementationSeedV1: parsedRequirementsState.implementationSeedV1,
      implementationTaskPlanV1: parsedRequirementsState.implementationTaskPlanV1,
      implementationCodeTaskPlanV1: parsedRequirementsState.implementationCodeTaskPlanV1,
      implementationTaskListV1: parsedRequirementsState.implementationTaskListV1,
      cursorWorkItemsV1: parsedRequirementsState.cursorWorkItemsV1,
      projectArtifacts: executionArtifacts.projectArtifacts,
      fastPlanDraftV1: parsedRequirementsState.fastPlanDraftV1,
      promptTimeline: parsedRequirementsState.promptTimeline,
      orchestration: parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: planningSlotDefinitions,
    });

    if (entryState.status === "board_ready") {
      if (entryState.needsCursorWorkItemsRegeneration && parsedRequirementsState.implementationTaskListV1) {
        const recovery = buildImplementationEntryCursorWorkItemsRecovery({
          projectId: pid,
          taskList: parsedRequirementsState.implementationTaskListV1,
          codeTaskPlan: parsedRequirementsState.implementationCodeTaskPlanV1,
          existingCursorWorkItems: parsedRequirementsState.cursorWorkItemsV1,
        });
        if (recovery.regenerated) {
          const nowIso = new Date().toISOString();
          void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
            cursorWorkItemsV1: [...recovery.cursorWorkItems],
            promptTimeline: [
              ...(parsedRequirementsState.promptTimeline ?? []),
              ...(recovery.timelineEntry ? [recovery.timelineEntry] : []),
              buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({
                projectId: pid,
                taskCount: entryState.taskCount,
                developerTaskCount: entryState.developerTaskCount,
                nowIso,
              }),
            ],
          });
          showToast("누락된 구현 준비 산출물을 복구했습니다.");
        }
      }
      const gate = evaluateImplementationCursorGate(implementationCursorGate);
      if (gate.allowed) {
        void startImplementationQuickRun();
        return;
      }
      appendAiNoticeForImplementation(formatImplementationCursorBlockedNotice(implementationCursorGate));
      return;
    }

    if (
      entryState.status === "seed_only" ||
      entryState.status === "task_plan_only" ||
      entryState.primaryAction === "GENERATE_IMPLEMENTATION_TASK_LIST"
    ) {
      void generateImplementationTaskList();
      return;
    }

    if (entryState.status === "quick_design_draft_unconfirmed") {
      void confirmQuickDesignForImplementation();
      return;
    }

    if (!effectiveImplementationState.implementationTaskPlanV1) {
      confirmImplementationTaskPlan();
      return;
    }
    const gate = evaluateImplementationCursorGate(implementationCursorGate);
    if (gate.allowed) {
      wipChipHandlers.requestCodeAgentWipWork();
      return;
    }
    const toast = buildPrepareImplementationExecutionToast(
      effectiveImplementationState.implementationTaskPlanV1,
    );
    if (toast) showToast(toast);
    else appendAiNoticeForImplementation(formatImplementationCursorBlockedNotice(implementationCursorGate));
  }, [
    projectId,
    protoBusy,
    executionAiSummaryBusy,
    implementationResetBusy,
    recordQuickRunClientEvent,
    parsedRequirementsState,
    executionArtifacts.projectArtifacts,
    planningSlotDefinitions,
    requirementsStateJson,
    persistChatToDb,
    showToast,
    implementationCursorGate,
    wipChipHandlers,
    executionSingleChat,
    generateImplementationTaskList,
    confirmQuickDesignForImplementation,
    effectiveImplementationState.implementationTaskPlanV1,
    confirmImplementationTaskPlan,
    executeImplementationStageAction,
    implementationStageBoardGateContext,
    startImplementationQuickRun,
  ]);

  const implementationInterviewUi = useMemo(() => {
    const base = buildImplementationSlotsInterviewUi({
      implementationSlotsV1: parsedRequirementsState.implementationSlotsV1,
      onQuickExecution: onImplementationQuickExecution,
    });
    const board = implementationStageBoardGateContext?.board ?? null;
    const quickRun = parseImplementationQuickRunV1(
      orchestrationAwareRequirementsState.implementationQuickRunV1,
    );
    return overlayImplementationInterviewUiWithTaskExecutionProgress(base, {
      board,
      quickRun,
    });
  }, [
    parsedRequirementsState.implementationSlotsV1,
    onImplementationQuickExecution,
    implementationStageBoardGateContext?.board,
    orchestrationAwareRequirementsState.implementationQuickRunV1,
  ]);

  const onDownloadImplementationConversationMarkdown = useCallback(() => {
    const pid = projectId.trim();
    const md = buildConversationMarkdown({
      heading: "# 구현 단계 대화 내역",
      scopeLines: [`- projectId: ${pid || "(미연결)"}`, `- exportedAt: ${new Date().toISOString()}`],
      messages: executionSingleChat.chatMessages,
      meLabel: "나",
    });
    downloadConversationMarkdownFile({ markdown: md, filenameStem: (projectName || "구현").trim() || "구현" });
  }, [executionSingleChat.chatMessages, projectId, projectName]);

  const onResetImplementationConversation = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid || protoBusy || implementationResetBusy) return;
    if (
      !confirmResetConversation({
        message:
          "구현 대화·작업안·Seed·WIP·실행 로그를 모두 삭제하고 구현 단계를 다시 시작할까요? 기획 산출물과 슬롯은 유지됩니다. 이 작업은 되돌릴 수 없습니다.",
      })
    ) {
      return;
    }
    setImplementationResetBusy(true);
    implementationResetInFlightRef.current = true;
    try {
      setActiveTaskCursorJob(null);
      lastServerTaskCursorJobSyncFingerprintRef.current = "";

      const cascade = await postPlanningResetCascade({ projectId: pid, reason: "manual" });
      if (!cascade.success) {
        throw new Error(cascade.message ?? "구현 Runtime DB 정리에 실패했습니다.");
      }
      setImplementationRuntimeDbBundle(null);

      const nowIso = new Date().toISOString();
      const resetState = buildImplementationConversationResetStateJson(
        parseRequirementsStateJson(requirementsStateJson),
        nowIso,
      );
      lastPersistedChatFingerprintRef.current = "";
      setTimelineCards([]);
      lastTimelineSnapRef.current = "";
      setPrePlanGate("idle");
      setPlannerCreatePending(false);
      setPlannerProgressStep(1);
      setImplementationConversationResetNonce((n) => n + 1);
      requirementsStateJsonRef.current = resetState;
      setPendingImplementationPatch(null);
      orchestrationPersistSeqRef.current += 1;
      onRequirementsStateJsonChange?.(resetState);

      const { res, json: raw } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: resetState });
      const json = raw as SpecWorkspaceProjectPatchResponseBody;
      if (!res.ok || !json.success || json.data?.patchApplied === false || !json.data?.project) {
        showToast(json.message ?? "구현 대화 초기화에 실패했습니다.");
        return;
      }
      const persistedReset = parseRequirementsStateJson(
        json.data.project.requirementsStateJson ?? resetState,
      );
      requirementsStateJsonRef.current = persistedReset;
      onRequirementsStateJsonChange?.(persistedReset);
      showToast("구현 세션을 초기화했습니다. AI개발자 진입 안내를 다시 표시합니다.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "구현 대화 초기화 중 오류가 발생했습니다.");
    } finally {
      implementationResetInFlightRef.current = false;
      setImplementationResetBusy(false);
    }
  }, [
    projectId,
    protoBusy,
    implementationResetBusy,
    requirementsStateJson,
    onRequirementsStateJsonChange,
    showToast,
  ]);

  const onSummarizeImplementationConversation = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid || protoBusy || executionAiSummaryBusy) return;
    if (!executionSingleChat.chatMessages.length) {
      showToast("요약할 대화가 없습니다.");
      return;
    }
    setExecutionAiSummaryBusy(true);
    try {
      const contentHtml = buildConversationContentHtmlForWorkNoteSummary(executionSingleChat.chatMessages, "나", {
        maxMessages: 80,
      });
      const wire = await postWorkNoteSummarize({ projectId: pid, scope: "project", contentHtml });
      appendAiNoticeForImplementation(
        [
          "AI 요약",
          "",
          wire.summary,
          "",
          `요청 분류 ${wire.requestType}`,
          `우선순위 추천 ${wire.priority}`,
          ...(wire.priorityReason?.trim() ? [`근거 ${wire.priorityReason.trim()}`] : []),
        ].join("\n"),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "AI 요약에 실패했습니다.");
    } finally {
      setExecutionAiSummaryBusy(false);
    }
  }, [projectId, protoBusy, executionAiSummaryBusy, executionSingleChat, showToast]);

  const onOpenImplementationTemplateChange = useCallback(() => {
    if (!canRequestGeneration.envOk) {
      showToast("환경 검증과 연결 테스트가 완료된 뒤 템플릿을 변경할 수 있습니다.");
      return;
    }
    if (shouldLockInlineChatTemplateSelection(latestRun)) {
      showToast("작업계획이 생성된 뒤에는 템플릿을 변경할 수 없습니다.");
      return;
    }
    setTemplateChangeOpen(true);
  }, [canRequestGeneration.envOk, latestRun, showToast]);

  const implementationTemplateChangeDisabled =
    !canRequestGeneration.envOk || shouldLockInlineChatTemplateSelection(latestRun) || protoBusy;

  const onOpenExecutionEnvironmentSettings = useCallback(() => {
    setExecutionEnvironmentModalOpen(true);
  }, []);

  const onOpenImplementationExecutionLog = useCallback(() => {
    setImplementationPromptDrawerTab("execution_log");
    setImplementationPromptDrawerOpen(true);
  }, []);

  const executionConversationIconToolbar = useMemo(
    () => (
      <>
        {!isImplementationToolbarMobileCompact ? (
          <>
            <WorkspaceHubChromeIconButton
              title={IMPLEMENTATION_ENV_SETTINGS_LABEL}
              ariaLabel={IMPLEMENTATION_ENV_SETTINGS_LABEL}
              disabled={false}
              onClick={onOpenExecutionEnvironmentSettings}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </WorkspaceHubChromeIconButton>
            <WorkspaceHubChromeIconButton
              title="상세 로그 보기"
              ariaLabel="상세 로그 보기"
              disabled={false}
              onClick={onOpenImplementationExecutionLog}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 12h-5" />
                <path d="M15 8h-5" />
                <path d="M19 17V5a2 2 0 0 0-2-2H4" />
                <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
              </svg>
            </WorkspaceHubChromeIconButton>
            <WorkspaceHubChromeIconButton
              title="템플릿 변경"
              ariaLabel="템플릿 변경"
              disabled={implementationTemplateChangeDisabled}
              onClick={onOpenImplementationTemplateChange}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </WorkspaceHubChromeIconButton>
          </>
        ) : null}

        <WorkspaceConversationHubIconRow
          busy={protoBusy || executionAiSummaryBusy || implementationResetBusy}
          interviewUi={implementationInterviewUi}
          slotsChromeLabels={{
            progressLabel: IMPLEMENTATION_PROGRESS_LABEL,
            detailAriaLabel: IMPLEMENTATION_SLOTS_DETAIL_ARIA_LABEL,
          }}
          quickExecutionTitle="빠른 실행 - 구현 작업안WIP"
          quickExecutionAriaLabel="빠른 실행 - 선택한 구현 Task를 자동 진행합니다"
          memberControls={{
            count: implementationParticipantCount,
            onOpen: () => setProtoMembersModalOpen(true),
          }}
          artifactHubControls={{
            count: implementationArtifactHubView.badgeCount,
            hasStale: false,
            title: IMPLEMENTATION_ARTIFACT_HUB_LABEL,
            onOpen: () => setArtifactHubOpen(true),
          }}
          onDownloadConversationMarkdown={onDownloadImplementationConversationMarkdown}
          onResetConversation={onResetImplementationConversation}
          onSummarizeConversation={onSummarizeImplementationConversation}
          resetConversationDisabled={
            protoBusy ||
            implementationResetBusy ||
            executionSingleChat.conversationStatus !== "loaded" ||
            !executionSingleChat.chatMessages.length
          }
          iconLayout={isImplementationToolbarMobileCompact ? "mobileCompact" : "full"}
          overflowMenuItems={
            isImplementationToolbarMobileCompact
              ? [
                  {
                    id: "env-settings",
                    label: IMPLEMENTATION_ENV_SETTINGS_LABEL,
                    onClick: onOpenExecutionEnvironmentSettings,
                  },
                  {
                    id: "execution-log",
                    label: "상세 로그 보기",
                    onClick: onOpenImplementationExecutionLog,
                  },
                  {
                    id: "template-change",
                    label: "템플릿 변경",
                    onClick: onOpenImplementationTemplateChange,
                    disabled: implementationTemplateChangeDisabled,
                  },
                ]
              : []
          }
        />
      </>
    ),
    [
      isImplementationToolbarMobileCompact,
      protoBusy,
      executionAiSummaryBusy,
      implementationInterviewUi,
      implementationParticipantCount,
      implementationArtifactHubView.badgeCount,
      implementationTemplateChangeDisabled,
      onOpenImplementationTemplateChange,
      onOpenExecutionEnvironmentSettings,
      onOpenImplementationExecutionLog,
      onDownloadImplementationConversationMarkdown,
      onResetImplementationConversation,
      onSummarizeImplementationConversation,
      executionSingleChat.conversationStatus,
      executionSingleChat.chatMessages.length,
      implementationResetBusy,
    ],
  );

  return (
    <div
      className="jyo-prototype-generation-root"
      style={{
        position: "relative",
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes jyo-proto-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .jyo-prototype-stage-shell { height: 100%; min-height: 0; overflow-x: hidden; overflow-y: auto; }
        .jyo-prototype-generation-root input,
        .jyo-prototype-generation-root select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      {toast ? (
        <div style={toastStyle}>
          {toast}
        </div>
      ) : null}
      <div className="jyo-prototype-stage-shell" style={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <ImplementationStageGlobalToolbar>{executionConversationIconToolbar}</ImplementationStageGlobalToolbar>
        {implementationBoard && implementationStageBoardInput ? (
          <ImplementationExecutionBoardPanel
            board={implementationBoard}
            taskList={implementationStageBoardInput.taskList}
            executionSetup={executionSetupRow}
            codeAgentWipExecutionV1={orchestrationAwareRequirementsState.codeAgentWipExecutionV1}
            taskCursorExecutionV1={orchestrationAwareRequirementsState.taskCursorExecutionV1}
            taskCursorExecutionHistoryV1={orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1}
            implementationAutoQualityGateV1={orchestrationAwareRequirementsState.implementationAutoQualityGateV1}
            implementationQuickRunV1={orchestrationAwareRequirementsState.implementationQuickRunV1}
            runtimeCodeTaskQueueView={effectiveCodeTaskExecutionQueueV1}
            codeTaskExecutionRunsV1={orchestrationAwareRequirementsState.codeTaskExecutionRunsV1}
            implementationPreviewScopeV1={orchestrationAwareRequirementsState.implementationPreviewScopeV1}
            implementationPreviewRuntimeV1={
              orchestrationAwareRequirementsState.implementationPreviewRuntimeV1
            }
            qualityGateResults={orchestrationAwareRequirementsState.implementationQualityGateResultsV1}
            boardState={orchestrationAwareRequirementsState.implementationExecutionBoardStateV1}
            previewReady={prototypeRunSyncSnapshot.previewReady}
            boardInput={implementationStageBoardInput}
            promptTimeline={orchestrationAwareRequirementsState.promptTimeline}
            activeTaskCursorJob={activeTaskCursorJob}
            onRestartTask={handleRestartBoardTask}
            onSelectedTaskIdsChange={handleBoardSelectedTaskIdsChange}
            onSelectedCodeTaskIdsChange={handleBoardSelectedCodeTaskIdsChange}
            onCopyCodeTaskCursorPrompt={handleCopyCodeTaskCursorPrompt}
            onCopyDeveloperPromptsFromHeader={handleCopyDeveloperPromptsFromHeader}
            onRetryGithubVerify={() => void handleManualGithubVerifyRetry()}
            onRetryFailedCodeTask={(codeTaskId) => void handleRetryFailedCodeTask(codeTaskId)}
            projectId={projectId.trim()}
            implementationRuntimeStateV1={resolveImplementationRuntimeStateForRead({
              raw: orchestrationAwareRequirementsState as Record<string, unknown>,
              projectId: projectId.trim(),
              dbBundle: implementationRuntimeDbBundle,
            })}
            implementationRuntimeDbBundle={implementationRuntimeDbBundle}
            codeTaskExecutionFeedbackV1={
              orchestrationAwareRequirementsState.implementationCodeTaskExecutionFeedbackV1
            }
            implementationCodeTaskPlanV1={
              orchestrationAwareRequirementsState.implementationCodeTaskPlanV1
            }
            codeTaskPromptContextMapV1={
              orchestrationAwareRequirementsState.codeTaskPromptContextMapV1
            }
            cursorWorkItemsV1={orchestrationAwareRequirementsState.cursorWorkItemsV1}
            onRunIntegrationPipeline={runIntegrationPipeline}
            integrationPipelineBusy={integrationPipelineBusy}
            codeTaskIntegrationPlanV1={
              orchestrationAwareRequirementsState.codeTaskIntegrationPlanV1
            }
            implementationIntegrationStepsV1={
              orchestrationAwareRequirementsState.implementationIntegrationStepsV1
            }
            onMergeIntegrationPullRequest={mergeIntegrationPullRequest}
            integrationMergeBusy={integrationMergeBusy}
            integrationPipelinePreviewReady={integrationPipelineClientResult?.previewReady}
            integrationPipelineStatus={integrationPipelineClientResult?.status}
            onOpenImplementationPreview={openImplementationPreview}
          />
        ) : null}
        {!boardPanelVisible ? (
        <div className="jyo-prototype-execution-chat-region">
        <PrototypeExecutionChatPanel
          conversationStatus={executionSingleChat.conversationStatus}
          chatMessages={prioritizedChatMessages}
          dashboardPanelActive={false}
          memberControls={null}
          input={executionSingleChat.input}
          onInputChange={executionSingleChat.setInput}
          onSend={() => void executionSingleChat.sendMessage()}
          busy={protoBusy}
          inputDisabled={isMessageInputBlocked}
          composerPlaceholder={chatPlaceholder}
          textAreaRef={chatInputRef}
          targetPickerItems={prototypeComposerAtAtItems}
          replyTo={executionSingleChat.replyTo}
          onClearReplyTo={() => executionSingleChat.setReplyTo(null)}
          onSetReplyTo={(id, preview) => executionSingleChat.setReplyTo({ id, preview })}
          onInterviewSuggestionPick={(label) => {
            if (handleImplementationChip(label)) return;
            const picked = executionSingleChat.handleInterviewSuggestionPick(label);
            if (picked.kind === "action") handleChatIntent(picked.action);
          }}
          aiInvokePending={executionSingleChat.aiInvokePending}
          activityStatus={executionActivityStatus}
        />
        {isNextPublicDevWorkflowToolsEnabled() ? (
          <details style={{ fontSize: 11, color: "#475569", flexShrink: 0, margin: "0 18px 12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>내부 오케스트레이션 (개발)</summary>
            <pre
              style={{
                marginTop: 8,
                fontSize: 10,
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {JSON.stringify(
                {
                  executionSlots,
                  plannerSource: latestRun?.plannerSource ?? null,
                  plannerError: latestRun?.plannerError ?? null,
                },
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}
        </div>
        ) : null}
      </div>

      <ImplementationStageNoticeModal
        open={boardPanelVisible && implementationStageNoticeModal != null}
        body={implementationStageNoticeModal?.body ?? ""}
        actionLabels={implementationStageNoticeModal?.actionLabels}
        onAction={(label) => {
          if (handleImplementationChip(label)) {
            setImplementationStageNoticeModal(null);
            return;
          }
          const picked = executionSingleChat.handleInterviewSuggestionPick(label);
          if (picked.kind === "action") handleChatIntent(picked.action);
          setImplementationStageNoticeModal(null);
        }}
        onClose={() => setImplementationStageNoticeModal(null)}
      />

      <RecommendationEvidenceDrawer
        open={recommendationPanelOpen}
        items={recommendationEvidenceItems}
        onClose={closeRecommendationPanel}
        closeOnEscape={!deliverableViewerOpen}
      />

      <RequirementsArtifactHubDrawer
        open={artifactHubOpen}
        artifactHubView={implementationArtifactHubView}
        items={implementationArtifactHubView.entries}
        projectName={projectName || "프로젝트"}
        projectId={projectId.trim() || undefined}
        projectArtifacts={planningOrchestrationView.projectArtifacts}
        deliverableAssets={planningOrchestrationView.deliverableAssets}
        generateDisabled
        lifecycleSummary={planningOrchestrationView.orchestrationUi.artifactLifecycleLabels.map((r) => ({
          label: r.label,
          hint: r.hint,
        }))}
        onClose={() => setArtifactHubOpen(false)}
        closeOnEscape={!deliverableViewerOpen}
        onSelectEntry={handleArtifactHubSelect}
        onGenerate={() => {
          showToast("문서 생성은 서비스 기획(/requirements) 화면에서 진행할 수 있습니다.");
        }}
        onArtifactBoardAction={(action) => handleArtifactBoardAction(action)}
        onExportFeedback={({ kind, count, blocked }) => {
          if (blocked) {
            showToast(blocked);
            return;
          }
          if (kind === "pdf") {
            showToast(
              count === 1
                ? "선택한 산출물 PDF 인쇄 창을 열었습니다."
                : `선택한 산출물 ${count}건 PDF 인쇄 창을 열었습니다.`,
            );
            return;
          }
          showToast(
            count === 1 ? "선택한 산출물을 Doc으로 내려받았습니다." : `선택한 산출물 ${count}건을 Doc으로 내려받았습니다.`,
          );
        }}
      />

      <RequirementsPromptDocumentDrawer
        open={implementationPromptDrawerOpen}
        onClose={() => setImplementationPromptDrawerOpen(false)}
        view={null}
        promptTimeline={orchestrationAwareRequirementsState.promptTimeline}
        conversationMessages={executionSingleChat.persistedConversationMessages}
        exportBaseName={projectName || "project"}
        initialTab={implementationPromptDrawerTab}
      />

      <RequirementsDeliverableViewerModal
        open={deliverableViewerOpen}
        onClose={() => setDeliverableViewerOpen(false)}
        assets={deliverableViewerAssets}
        initialAssetId={deliverableViewerFocusId}
      />

      <WorkspaceParticipantsModal
        open={protoMembersModalOpen}
        onClose={() => setProtoMembersModalOpen(false)}
        participants={prototypeModalParticipants}
        showInvite={false}
        inviteDisabled
        onInviteClick={() => {}}
      />

      <ProjectExecutionEnvironmentModal
        open={executionEnvironmentModalOpen}
        onClose={() => {
          setExecutionEnvironmentModalOpen(false);
          void handleExecutionSetupChanged();
        }}
        onSetupSaved={() => {
          void handleExecutionSetupChanged();
        }}
        projectId={projectId}
        project={executionEnvironmentModalProject}
        canEdit={true}
      />

      <PrototypeTemplateChangeModal
        open={templateChangeOpen}
        onClose={() => setTemplateChangeOpen(false)}
        canChange={canRequestGeneration.envOk && !shouldLockInlineChatTemplateSelection(latestRun)}
        draftPickerValue={draftPickerValue}
        recommendedTemplateId={analysis.recommendedTemplate}
        recommendedTemplateNameKo={effectiveTemplateDef?.nameKo ?? analysis.recommendedTemplate}
        disabled={protoBusy}
        onSelect={applyToolbarTemplateSelection}
        onPreview={() => {
          setTemplateChangeOpen(false);
          setTemplatePreviewOpen(true);
        }}
      />

      <PrototypePreviewDraggableShell
        open={templatePreviewOpen}
        onClose={() => setTemplatePreviewOpen(false)}
        title="템플릿 미리보기"
        modalWidth="min(980px, calc(100vw - 20px))"
        tone="showcase"
      >
        {effectiveTemplateDef ? (
          <div style={{ display: "grid", gap: 12 }}>
            <PrototypeTemplateMockPreview template={effectiveTemplateDef!} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setTemplatePreviewOpen(false)} style={btnMuted}>닫기</button>
              <button
                type="button"
                onClick={() => void onCursorAutoRequest()}
                disabled={!canStartPrototypeAutomation || protoBusy || isRunningState}
                style={btnPrimary}
              >
                이 템플릿으로 자동 실행 시작
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>템플릿 정보를 찾을 수 없습니다.</div>
        )}
      </PrototypePreviewDraggableShell>

      {plannerPromptModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPlannerPromptModalOpen(false)}
        >
          <div
            style={{
              width: "min(900px, 100%)",
              maxHeight: "min(85vh, 900px)",
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 15,
                fontWeight: 1000,
                color: "#0f172a",
              }}
            >
              플래너 입력 프롬프트
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#334155",
                }}
              >
                {plannerCombinedInputPreview.trim() || "표시할 프롬프트가 아직 없습니다."}
              </pre>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const t = plannerCombinedInputPreview.trim();
                  if (!t) {
                    showToast("복사할 내용이 없습니다.");
                    return;
                  }
                  const p = navigator.clipboard?.writeText(t);
                  if (p) {
                    void p
                      .then(() => showToast("클립보드에 복사했습니다."))
                      .catch(() => showToast("복사에 실패했습니다."));
                  } else {
                    showToast("이 환경에서는 클립보드 복사를 사용할 수 없습니다.");
                  }
                }}
                style={btnPrimary}
              >
                복사하기
              </button>
              <button type="button" onClick={() => setPlannerPromptModalOpen(false)} style={btnMuted}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelConfirmOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setCancelConfirmOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a" }}>자동 생성을 중단할까요?</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
              현재 진행 중인 Cursor/Git 작업은 이미 일부 반영되었을 수 있습니다.
              <br />
              중단하면 플랫폼은 다음 단계 진행을 멈춥니다.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setCancelConfirmOpen(false)} style={btnMuted}>
                계속 진행
              </button>
              <button
                type="button"
                onClick={() => {
                  const rid = latestRun?.id;
                  if (!rid) return;
                  void (async () => {
                    setProtoBusy(true);
                    try {
                      const r = await postPrototypeRunCancel(rid, { projectId, reason: "user_requested" });
                      if (r.success && r.data?.run) setLatestRun(r.data.run);
                      showToast("중단 요청을 기록했습니다.");
                      setCancelConfirmOpen(false);
                      void refreshLatestRun();
                    } finally {
                      setProtoBusy(false);
                    }
                  })();
                }}
                disabled={protoBusy || !latestRun?.id}
                style={btnPrimary}
              >
                중단
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Re-export alias for new name usage (same behavior).
export const PrototypeGenerationWorkspace = PrototypePreviewPanel;

const summaryChip: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const card: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
};

const btn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const btnPrimary: CSSProperties = {
  ...btn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

const btnMuted: CSSProperties = {
  ...btn,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const templateModeToggleWrap: CSSProperties = {
  display: "inline-flex",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#e2e8f0",
  padding: 3,
  gap: 3,
};

const templateModeToggleSeg: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const templateModeToggleActive: CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const templateModeToggleIdle: CSSProperties = {
  background: "transparent",
  color: "#64748b",
};

const selectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 800,
  color: "#0f172a",
};

const toastStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 60,
  padding: "10px 14px",
  borderRadius: 12,
  background: "#0f172a",
  color: "#fff",
  fontSize: 12.5,
  fontWeight: 800,
  maxWidth: 360,
  boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
};
