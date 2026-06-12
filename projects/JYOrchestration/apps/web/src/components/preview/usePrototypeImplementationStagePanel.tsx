"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrototypeChatAction } from "@/lib/prototype/buildPrototypeChatMessages";
import { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import { useImplementationRuntimeDbSync } from "@/components/preview/useImplementationRuntimeDbSync";
import { useDbQueuedQuickRunAutoDispatch } from "@/components/preview/useDbQueuedQuickRunAutoDispatch";
import { useApplyImplementationOrchestrationResult } from "@/components/preview/useApplyImplementationOrchestrationResult";
import { usePrototypeExecutionPersistChatToDb } from "@/components/preview/usePrototypeExecutionPersistChatToDb";
import { useImplementationStageActionTimeline } from "@/components/preview/useImplementationStageActionTimeline";
import { useRecoverServerQuickRunContinuation } from "@/components/preview/useRecoverServerQuickRunContinuation";
import { useTaskCursorServerJobPoll } from "@/components/preview/useTaskCursorServerJobPoll";
import { useImplementationAutoQualityGateTrigger } from "@/components/preview/useImplementationAutoQualityGateTrigger";
import { executeImplementationBoardIntegrationPipeline } from "@/lib/prototype/implementationBoardIntegrationPipelineRun";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";

import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import { DB_INTEGRATION_REVIEW_CHIP } from "@/lib/prototype/implementationDbStrategy";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_QUICK_RUN_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import {
  buildImplementationBootstrapInput,
  isPrototypeExecutionEnvLoading,
  pickExecutionStateArtifacts,
  toPrototypeChatEnvSnapshot,
} from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import {
  buildImplementationWipDraftLifecycleTimelineEntry,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
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
import { type ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
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
  buildImplementationBootstrapShellView,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
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
  countTaskListWipCandidateTasks,
  formatTaskScopedWipExecutionBlockedNotice,
  isImplementationReadyForReviewStage,
  pickFirstExecutableDeveloperTaskId,
  pickQualityGateTargetTaskIds,
  resolveTaskRowUserRestartCapability,
  selectCursorWorkItemsForWipExecution,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import {
  mergeIntegrationPullRequestClient,
} from "@/lib/prototype/implementationIntegrationClient";
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
import { isLegacyContinuePreviewMessage } from "@/lib/prototype/implementationIntegrationToastPolicy";
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
import { dedupeImplementationStageNextActions, extractBoardVisibleActionLabels } from "@/lib/prototype/implementationExecutionBoardPanelView";
import {
  appendReworkRequest,
  markReworkRequestsAcceptedForTask,
  resolveAllPendingUserConfirmations,
  updateBoardSelectedTaskIds,
} from "@/lib/prototype/implementationExecutionBoardState";
import { updateBoardCheckedCodeTaskIds } from "@/lib/prototype/implementationBoardCheckedIds";
import { resolveCheckedCodeTaskIdsFromBoardBridge } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import {
  buildImplementationQuickRunQueueItems,
  buildQuickRunOrchestrationAfterJobStart,
  buildImplementationQuickRunRequirementsPrepPersistPatch,
  buildRepairTimelineEntries,
  continueImplementationQuickRunAfterStart,
  prepareRequirementsStateForImplementationQuickRun,
  evaluateImplementationQuickRunPrepAndSelection,
  postImplementationQuickRunStartJob,
} from "@/lib/prototype/implementationQuickRunStartService";
import { loadImplementationExecutionUnitsFromState, parseImplementationExecutionUnitsStateV1 } from "@/lib/prototype/implementationExecutionUnitStore";
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
  readImplementationStageChatMessages,
  readImplementationStageChatPatch,
} from "@/lib/prototype/implementationStageChatSnapshot";
import {
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
import { resolveCodeTaskRunForAutoQualityGateClient } from "@/lib/prototype/implementationAutoQualityGateClient";
import {
  buildImplementationExecutionLogTimelineEntry,
  buildPromptTimelineOrchestrationPatch,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import { mergeImplementationExecutionLogTimeline } from "@/lib/prototype/implementationOrchestrationExecutionLog";
import {
  pickPersistentExecutionLogTimelineEntries,
  stripExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";
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
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
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
  parseImplementationQuickRunV1,
  resolveQuickRunAllowedTaskIds,
} from "@/lib/prototype/implementationQuickRun";
import {
  runQuickRunStuckGithubVerifyRecovery,
  runCodeTaskGithubVerifyRecheck,
} from "@/lib/prototype/implementationQuickRunGithubVerifyRecovery";
import {
  applyTaskCursorGithubVerifyApiResult,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
  resolveTaskCursorGithubVerifyUserNotice,
} from "@/lib/prototype/taskCursorGithubVerifyClient";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { normalizeSelectedTaskIds } from "@/lib/prototype/implementationTaskTreeSelection";
import { ImplementationExecutionLogModal } from "@/components/preview/ImplementationExecutionLogModal";
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
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { parseTaskCursorExecutionV1, patchTaskCursorExecution, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { buildDisplayedPlannerUserMessage, workUnitProgressAllMerged } from "@/components/preview/prototypePreviewPanelHelpers";
import {
  isPrototypeTemplatePlanningReady,
  shouldLockInlineChatTemplateSelection,
} from "@/lib/prototype/prototypeRunUiHelpers";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import type {
  PrototypeWorkspaceActor as PrototypePreviewActor,
  PrototypeWorkspaceFlowStep as PrototypePreviewFlowStep,
  PrototypeWorkspaceIdeationAsset,
} from "@/components/preview/prototypeWorkspaceTypes";
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
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";

import type { MutableRefObject, ReactNode, RefObject } from "react";

function isLikelyPreviewUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

export type PrototypeImplementationStageHost = Readonly<{
  projectId: string;
  projectName: string;
  projectDescription: string;
  requirementsStateJson: unknown;
  onRequirementsStateJsonChange?: (next: unknown) => void;
  orchestrationPersistSeqRef: RefObject<number>;
  featureDraftTitles?: readonly string[];
  protoBusy: boolean;
  setProtoBusy: (busy: boolean) => void;
  latestRun: PrototypeRun | null;
  setLatestRun: (run: PrototypeRun | null) => void;
  refreshLatestRun: () => Promise<void>;
  executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  canRequestGeneration: Readonly<{ envOk: boolean; designOk: boolean }>;
  executionEnvLoading: boolean;
  executionEnvSnapshot: ReturnType<typeof toPrototypeChatEnvSnapshot>;
  envSettingsHref: string;
  canApplyGit: boolean | undefined;
  previewUrl: string | null;
  autoRefineImplementationPrep?: boolean;
  setExecutionEnvironmentModalOpen: (open: boolean) => void;
  isPlannerRunning: boolean;
  plannerCreatePending: boolean;
  plannerProgressStep: number;
  executionEnvRefreshInFlight: boolean;
  servicePlanningAgentCatalogKeys?: readonly string[];
  effectiveTemplate: PrototypeTemplateType;
  effectiveTemplateDef: (typeof PROTOTYPE_TEMPLATES)[number] | null;
  ideationSummaryForChat: string;
  actorFlowSummaryForChat: string;
  isDraftGenerationComplete: boolean;
  isRunningState: boolean;
  templatePlanningReady: boolean;
  plannerContextPayload: Readonly<{
    projectDescription: string;
    actorFlowSummary: string;
    featureDraftTitles: readonly string[];
    ideationSummary: string;
  }>;
  appendExecutionNoticeRef: MutableRefObject<(text: string) => void>;
  startWorkPlanGenerationFromChat: () => void;
  setPlannerPromptModalOpen: (open: boolean) => void;
  handleChatIntent: (action: PrototypeChatAction) => void;
  confirmExecution: () => void;
  onRefreshPrototypeStatus: () => void | Promise<void>;
  parsedRequirementsState: ReturnType<typeof parseRequirementsStateJson>;
  pendingImplementationPatchRef: MutableRefObject<import("@/lib/prototype/effectiveImplementationState").PendingImplementationPatch>;
  requirementsStateJsonRef: RefObject<unknown>;
  applyPendingFromOrchestrationPatchRef: MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  persistChatToDb: ReturnType<
    typeof usePrototypeExecutionPersistChatToDb
  >["persistChatToDb"];
  executionSlots: ReturnType<typeof computePrototypeExecutionSlots>;
  refreshExecutionEnvironmentStatus: () => Promise<ExecutionSetupSourceGenerationRow | null>;
}>;

export type UsePrototypeImplementationStagePanelResult = Readonly<{
  planningOrchestrationView: ReturnType<typeof buildPrototypeExecutionPlanningOrchestrationView>;
  recommendationEvidence: import("@/lib/recommendation/useProjectRecommendationEvidence").UseProjectRecommendationEvidenceResult;
  deliverableViewer: Readonly<{
    readonly open: boolean;
    readonly focusAssetId: string | null;
    readonly openDeliverables: (ids: readonly string[], focusId?: string | null) => void;
    readonly close: () => void;
  }>;
  onPickImplementationInterviewLabel: (label: string) => void;
  orchestrationAwareRequirementsState: ReturnType<typeof resolveOrchestrationAwareRequirementsState>;
  executionConversationIconToolbar: ReactNode;
  implementationBoard: NonNullable<
    ReturnType<typeof buildImplementationStageBoardGateContext>
  >["board"] | null;
  implementationStageBoardInput: {
    readonly projectId: string;
    readonly taskList: NonNullable<
      ReturnType<typeof resolveOrchestrationAwareRequirementsState>["implementationTaskListV1"]
    >;
    readonly executionState: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationTaskExecutionStateV1"];
    readonly integratedExecutionState: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationIntegratedExecutionStateV1"];
    readonly boardState: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationExecutionBoardStateV1"];
    readonly qualityGateResults: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationQualityGateResultsV1"];
    readonly previewReady: boolean;
    readonly implementationReviewStageReadyV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationReviewStageReadyV1"];
    readonly reviewStageUserTestSessionV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["reviewStageUserTestSessionV1"];
    readonly reviewStageUserFeedbackListV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["reviewStageUserFeedbackListV1"];
    readonly codeAgentWipExecutionV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["codeAgentWipExecutionV1"];
    readonly taskCursorExecutionV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["taskCursorExecutionV1"];
    readonly implementationAutoQualityGateV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationAutoQualityGateV1"];
    readonly implementationCodeTaskPlanV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["implementationCodeTaskPlanV1"];
    readonly codeTaskExecutionRunsV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["codeTaskExecutionRunsV1"];
    readonly taskCursorExecutionHistoryV1: ReturnType<
      typeof resolveOrchestrationAwareRequirementsState
    >["taskCursorExecutionHistoryV1"];
    readonly canApplyGit: boolean | undefined;
  } | null;
  prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  effectiveCodeTaskExecutionQueueV1: ReturnType<typeof resolveEffectiveCodeTaskExecutionQueue>;
  boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  activeTaskCursorJob: TaskCursorJobSummary | null;
  handleRestartBoardTask: (taskId: string) => void;
  handleBoardSelectedTaskIdsChange: (ids: readonly string[]) => void;
  handleBoardSelectedCodeTaskIdsChange: (ids: readonly string[]) => void;
  handleCopyCodeTaskCursorPrompt: (codeTaskId: string) => void;
  handleCopyDeveloperPromptsFromHeader: () => void;
  handleManualGithubVerifyRetry: () => void | Promise<void>;
  handleRecheckCodeTaskGithubVerify: (input: { codeTaskId: string }) => void | Promise<void>;
  githubRecheckBusyCodeTaskId: string | null;
  handleRetryFailedCodeTask: (codeTaskId: string) => void | Promise<void>;
  implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  runIntegrationPipeline: () => void;
  integrationPipelineBusy: boolean;
  mergeIntegrationPullRequest: () => void | Promise<void>;
  integrationMergeBusy: boolean;
  integrationPipelineClientResult: { readonly status?: string; readonly previewReady?: boolean; readonly receivedAt?: number } | null;
  openImplementationPreview: (input: {
    readonly mode: import("@/lib/prototype/implementationPreviewEntryPolicy").ImplementationPreviewEntryModeV1;
    readonly url: string;
  }) => void;
  handleExecutionSetupChanged: () => Promise<void>;
  startImplementationQuickRun: (options?: { readonly selectedCodeTaskIds?: readonly string[] }) => Promise<ImplementationStageActionRunResult>;
  orchestrationAwareRequirementsStateRef: RefObject<ReturnType<typeof resolveOrchestrationAwareRequirementsState>>;
  implementationBootstrapShell: ReturnType<typeof buildImplementationBootstrapShellView> | null;
  implementationStageNoticeModal: { readonly body: string; readonly actionLabels?: readonly string[] } | null;
  setImplementationStageNoticeModal: (
    value:
      | { readonly body: string; readonly actionLabels?: readonly string[] }
      | null
      | ((prev: { readonly body: string; readonly actionLabels?: readonly string[] } | null) => {
          readonly body: string;
          readonly actionLabels?: readonly string[];
        } | null),
  ) => void;
  implementationExecutionLogModalOpen: boolean;
  setImplementationExecutionLogModalOpen: (open: boolean) => void;
  onClearImplementationExecutionLog: () => void;
  latestRunForDevTools: PrototypeRun | null;
  executionSlotsForDevTools: ReturnType<typeof computePrototypeExecutionSlots>;
}>;

export function usePrototypeImplementationStagePanel(
  host: PrototypeImplementationStageHost,
): UsePrototypeImplementationStagePanelResult {
  const {
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    featureDraftTitles,
    protoBusy,
    setProtoBusy,
    latestRun,
    setLatestRun,
    refreshLatestRun,
    onRequirementsStateJsonChange,
    orchestrationPersistSeqRef,
    executionSetupRow,
    canRequestGeneration,
    executionEnvLoading,
    executionEnvSnapshot,
    envSettingsHref,
    canApplyGit,
    previewUrl,
    autoRefineImplementationPrep,
    setExecutionEnvironmentModalOpen,
    isPlannerRunning,
    plannerCreatePending,
    plannerProgressStep,
    executionEnvRefreshInFlight,
    servicePlanningAgentCatalogKeys,
    effectiveTemplate,
    effectiveTemplateDef,
    ideationSummaryForChat,
    actorFlowSummaryForChat,
    isDraftGenerationComplete,
    isRunningState,
    templatePlanningReady,
    plannerContextPayload,
    appendExecutionNoticeRef,
    startWorkPlanGenerationFromChat,
    setPlannerPromptModalOpen,
    handleChatIntent,
    confirmExecution,
    onRefreshPrototypeStatus,
    parsedRequirementsState,
    requirementsStateJsonRef,
    applyPendingFromOrchestrationPatchRef,
    persistChatToDb,
    executionSlots,
    pendingImplementationPatchRef: hostPendingImplementationPatchRef,
    refreshExecutionEnvironmentStatus,
  } = host;

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

  const [pendingImplementationPatch, setPendingImplementationPatch] =
    useState<PendingImplementationPatch>({});
  const pendingImplementationPatchRef = hostPendingImplementationPatchRef;
  pendingImplementationPatchRef.current = pendingImplementationPatch;

  const [implementationExecutionLogModalOpen, setImplementationExecutionLogModalOpen] = useState(false);

  const executionSetupBoardSyncedKeyRef = useRef<string | null>(null);
  const refreshImplementationBoardRef = useRef<
    ((setup: ExecutionSetupSourceGenerationRow | null, source?: string) => void) | null
  >(null);
  const implementationResetInFlightRef = useRef(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastServerTaskCursorJobSyncFingerprintRef = useRef("");

  const quickRunCodeTaskContinuationRef = useRef<string | null>(null);
  const quickRunStuckGithubVerifyRef = useRef<string | null>(null);
  const codeTaskDispatchPreferredTaskIdRef = useRef<string | null>(null);
  const pendingQuickRunQueueDispatchRef = useRef<CodeTaskQueueDispatchRef | null>(null);
  const dbQueuedQuickRunDispatchRef = useRef<string | null>(null);
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

  const boardSelectionBridge = useImplementationBoardSelectionBridge(projectId);

  const {
    implementationRuntimeDbBundle,
    setImplementationRuntimeDbBundle,
    loadImplementationRuntimeDb,
    applyImplementationRuntimeFetch,
    implementationRuntimePollSuspendedRef,
  } = useImplementationRuntimeDbSync({
    projectId,
    taskCursorExecutionV1: orchestrationAwareRequirementsState.taskCursorExecutionV1,
  });

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
      setPendingImplementationPatch({} as PendingImplementationPatch);
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
      readonly selectedCount?: number;
    }) => {
      const pid = projectId.trim();
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
    [persistChatToDb, projectId],
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

  const implementationBoardVisibleActionLabels = useMemo(() => {
    if (!implementationBoard || !implementationStageBoardInput) return [];
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
  }, [implementationBoard, implementationStageBoardInput, effectiveImplementationState]);

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

  const implementationBootstrapShell = useMemo(() => {
    if (implementationBoard) return null;
    return buildImplementationBootstrapShellView({
      summaryInput: implementationBootstrapInput,
      actionLabels: implementationVisibleActionLabels,
    });
  }, [implementationBoard, implementationBootstrapInput, implementationVisibleActionLabels]);

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
      if (integratedReady) return;
      setImplementationStageNoticeModal({ body: text });
    },
    [projectId],
  );

  const showToast = useCallback(
    (message: string) => {
      const text = String(message ?? "").trim();
      if (text) appendAiNoticeForImplementation(text);
    },
    [appendAiNoticeForImplementation],
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

  appendExecutionNoticeRef.current = appendImplementationExecutionNotice;

  const applyImplementationOrchestrationResult = useApplyImplementationOrchestrationResult({
    projectId,
    requirementsStateJson,
    requirementsStateJsonRef,
    orchestrationPersistSeqRef,
    persistChatToDb,
    applyPendingFromOrchestrationPatch,
    onRequirementsStateJsonChange,
  });

  const applyImplementationOrchestrationResultRef = useRef(applyImplementationOrchestrationResult);
  useEffect(() => {
    applyImplementationOrchestrationResultRef.current = applyImplementationOrchestrationResult;
  }, [applyImplementationOrchestrationResult]);

  const executionSingleChatMessagesRef = useRef(readImplementationStageChatMessages(requirementsStateJsonRef.current));
  executionSingleChatMessagesRef.current = readImplementationStageChatMessages(requirementsStateJsonRef.current);

  useDbQueuedQuickRunAutoDispatch({
    projectId,
    implementationQuickRunV1: orchestrationAwareRequirementsState.implementationQuickRunV1,
    implementationRuntimeDbBundle,
    runtimePollSuspendedRef: implementationRuntimePollSuspendedRef,
    dbQueuedQuickRunDispatchRef,
    enrichOrchestrationPatch: enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationPatch: (patch) => {
      applyImplementationOrchestrationResultRef.current({
        orchestrationPatch: patch,
      });
    },
    reloadRuntime: () => {
      void loadImplementationRuntimeDb({ recover: false });
    },
  });

  useRecoverServerQuickRunContinuation({
    projectId,
    autoQualityGateStatus:
      orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.status,
    autoQualityGateSourceCommitSha:
      orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.sourceCommitSha,
    promptTimeline: orchestrationAwareRequirementsState.promptTimeline,
    fallbackRunsV1: orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    implementationRuntimeDbBundle,
    requirementsStateJsonRef,
    orchestrationAwareRequirementsState,
    enrichOrchestrationPatch: enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationPatch: (patch) => {
      applyImplementationOrchestrationResult({
        orchestrationPatch: patch,
      });
    },
  });

  useTaskCursorServerJobPoll({
    projectId,
    requirementsStateJsonRef,
    implementationResetInFlightRef,
    taskCursorExecutionStatus: orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    taskCursorCursorRunId: orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    setActiveTaskCursorJob,
    enrichOrchestrationPatch: enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationResult: (orchInput) => {
      applyImplementationOrchestrationResultRef.current(orchInput);
    },
    chatMessagesRef: executionSingleChatMessagesRef,
  });

  const {
    triggerRef: triggerImplementationAutoQualityGateRef,
    failedTriggerRef: autoQualityGateFailedTriggerRef,
    completedTriggerRef: autoQualityGateCompletedTriggerRef,
  } = useImplementationAutoQualityGateTrigger({
    projectId,
    requirementsStateJsonRef,
    enrichOrchestrationPatch: enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationResult: (orchInput) => {
      applyImplementationOrchestrationResultRef.current(orchInput);
    },
    chatMessagesRef: executionSingleChatMessagesRef,
    appendExecutionNotice: appendImplementationExecutionNotice,
  });

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

  const dispatchNextQuickRunFromGithubVerify = useCallback(
    (next: QuickRunGithubAdvanceDispatch) => {
      pendingQuickRunQueueDispatchRef.current = {
        codeTaskId: next.codeTaskId,
        parentTaskId: next.parentTaskId,
        workItemId: next.workItemId,
      };
      codeTaskDispatchPreferredTaskIdRef.current = next.parentTaskId;
      runImplementationStageActionRef.current("REQUEST_TASK_CURSOR_EXECUTION");
    },
    [],
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
        orchestrationPatch: patch,
        });
      },
      onNextQuickRunDispatch: dispatchNextQuickRunFromGithubVerify,
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
    readImplementationStageChatMessages(requirementsStateJsonRef.current),
    appendImplementationExecutionNotice,
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

  const [githubRecheckBusyCodeTaskId, setGithubRecheckBusyCodeTaskId] = useState<string | null>(
    null,
  );

  const handleRecheckCodeTaskGithubVerify = useCallback(
    async (input: {
      readonly codeTaskId: string;
      readonly rowPayload?: import("@/lib/prototype/codeTaskManualGithubRecheckPayload").CodeTaskManualGithubRecheckPayloadV1 | null;
    }) => {
      const pid = projectId.trim();
      const id = input.codeTaskId.trim();
      if (!pid || !id || githubRecheckBusyCodeTaskId === id) return;
      setGithubRecheckBusyCodeTaskId(id);
      try {
        const state = parseRequirementsStateJson(requirementsStateJsonRef.current);
        await runCodeTaskGithubVerifyRecheck({
          projectId: pid,
          codeTaskId: id,
          state,
          dbBundle: implementationRuntimeDbBundle,
          executionSetup: executionSetupRow ?? undefined,
          taskList: implementationStageBoardInput?.taskList,
          executionUnits:
            parseImplementationExecutionUnitsStateV1(
              orchestrationAwareRequirementsState.implementationExecutionUnitsV1,
            )?.units ?? undefined,
          rowPayload: input.rowPayload ?? undefined,
          continuationTriggerRef: quickRunCodeTaskContinuationRef,
          enrichPatch: enrichCodeTaskRunOrchestrationPatch,
          applyOrchestrationPatch: (patch) => {
            applyImplementationOrchestrationResult({
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
        });
        await loadImplementationRuntimeDb({ recover: true });
      } finally {
        setGithubRecheckBusyCodeTaskId((current) => (current === id ? null : current));
      }
    },
    [
      projectId,
      githubRecheckBusyCodeTaskId,
      implementationRuntimeDbBundle,
      executionSetupRow,
      implementationStageBoardInput?.taskList,
      orchestrationAwareRequirementsState.implementationExecutionUnitsV1,
      enrichCodeTaskRunOrchestrationPatch,
      applyImplementationOrchestrationResult,
      readImplementationStageChatMessages(requirementsStateJsonRef.current),
      appendImplementationExecutionNotice,
      dispatchNextQuickRunFromGithubVerify,
      applyImplementationRuntimeFetch,
      loadImplementationRuntimeDb,
    ],
  );

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
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_confirmed") {
      const message = "이미 구현 작업안이 확정되었습니다.";
      return { outcome: "no_op", message };
    }
    applyImplementationOrchestrationResult({
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
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_exists") {
      const message = "이미 구현 작업안 초안이 생성되었습니다.";
      return { outcome: "no_op", message };
    }
    const orchestrationPatch = {
      ...result.orchestrationPatch,
      promptTimeline: appendCreateWorkPlanBootstrapCtaRouteTimeline({
        promptTimeline: result.orchestrationPatch.promptTimeline ?? parsedRequirementsState.promptTimeline,
      }),
    };
    applyImplementationOrchestrationResult({
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
  ]);

  const appendStatusQueryFromChip = useCallback(
    (intent: ImplementationStatusQueryIntent) => {
      if (!implementationBootstrapInput) {
        appendAiNoticeForImplementation("환경 점검 결과를 표시할 수 없습니다. [환경 점검 결과]를 다시 선택해 주세요.");
        return;
      }
      const prior = readImplementationStageChatMessages(requirementsStateJsonRef.current);
      if (intent === "role_check_details" && hasImplementationRoleCheckDetailsShown(prior)) {
        appendAiNoticeForImplementation("역할별 점검 결과가 이미 표시되어 있습니다.");
        return;
      }
      const roleCheckSummary = buildImplementationRoleCheckSummary(implementationBootstrapInput);
      const aiMessage = buildImplementationStatusQueryMessage({
        intent,
        summaryInput: implementationBootstrapInput,
        roleCheckSummary,
      });
      if (!aiMessage) return;
      let timeline = parsedRequirementsState.promptTimeline;
      timeline = appendPromptTimeline(
        timeline,
        buildImplementationStatusQueryTimelineEntry({
          query: intent,
          summaryInput: implementationBootstrapInput,
          roleCheckSummary,
        }),
      );
      const chatPatch = readImplementationStageChatPatch(requirementsStateJsonRef.current);
      void persistChatToDb(chatPatch, { promptTimeline: timeline }, undefined, { force: true });
      appendAiNoticeForImplementation(String(aiMessage.content ?? "").trim());
    },
    [
      implementationBootstrapInput,
      requirementsStateJsonRef,
      parsedRequirementsState.promptTimeline,
      persistChatToDb,
      appendAiNoticeForImplementation,
    ],
  );

  const showRoleCheckDetails = useCallback(() => {
    appendStatusQueryFromChip("role_check_details");
  }, [appendStatusQueryFromChip]);

  const {
    persistStageActionTimelineEntries,
    persistImplementationStageActionRun,
    applyImplementationStageActionExecutionResult,
  } = useImplementationStageActionTimeline({
    projectId,
    requirementsStateJsonRef,
    pendingImplementationPatchRef,
    applyPendingFromOrchestrationPatchRef,
    persistChatToDb,
    appendUserNotice: appendAiNoticeForImplementation,
    setExecutionEnvironmentModalOpen,
    showRoleCheckDetails,
    appendStatusQueryFromChip,
  });

  const appendImplementationTaskListAiMessage = useCallback(
    (message: RequirementsMessage) => {
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
    },
    [projectId],
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
      return;
    }
    refreshImplementationBoardWithExecutionSetup(row, "execution_setup_saved");
  }, [refreshExecutionEnvironmentStatus, refreshImplementationBoardWithExecutionSetup]);

  const applyDbStrategyResult = useCallback(
    (
      result:
        | ReturnType<typeof buildDbIntegrationReviewResult>
        | ReturnType<typeof buildDataModelDraftResult>
        | ReturnType<typeof buildMockImplementationModeResult>,
    ): ImplementationStageActionRunResult => {
      if (result.kind === "blocked") {
        return { outcome: "blocked", message: result.message };
      }
      applyImplementationOrchestrationResult({
        messages: result.messages,
        orchestrationPatch: result.orchestrationPatch,
      });
      return { outcome: "executed" };
    },
    [applyImplementationOrchestrationResult],
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
          persistPatch.orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsStateJsonRef.current),
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
    [applyImplementationOrchestrationResult, readImplementationStageChatMessages(requirementsStateJsonRef.current)],
  );

  const persistPlatformScmMergePatch = useCallback(
    (persistPatch: PlatformScmMergePersistPatch) => {
      const patch = buildPlatformScmOrchestrationPatchFromPersist(persistPatch);
      if (!patch) return;
      applyImplementationOrchestrationResult({
        messages:
          persistPatch.orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsStateJsonRef.current),
        orchestrationPatch: {
          ...patch.orchestrationPatch,
          ...(patch.executionState
            ? { implementationTaskExecutionStateV1: patch.executionState }
            : {}),
        },
      });
    },
    [applyImplementationOrchestrationResult, readImplementationStageChatMessages(requirementsStateJsonRef.current)],
  );

  const tryAutoPlatformScmMergeAfterPush = useCallback(
    async (wip: CodeAgentWipExecutionV1) => {
      if (!shouldAttemptAutoPlatformScmMerge(wip)) return;
      try {
        const mergePatch = await applyPlatformScmMergeExecutorJson({ wip, autoMergeOnly: true });
        persistPlatformScmMergePatch(mergePatch);
        if (mergePatch.orchestration.message) {
        }
      } catch {
        // auto-merge is best-effort after push/PR
      }
    },
    [applyPlatformScmMergeExecutorJson, persistPlatformScmMergePatch],
  );

  const executePlatformScmAfterRequest = useCallback(
    (wip: CodeAgentWipExecutionV1) => {
      void (async () => {
        try {
          const persistPatch = await applyPlatformScmExecutorJson({ wip });
          persistPlatformScmOrchestrationPatch(persistPatch);
          const updatedWip =
            persistPatch.orchestration.orchestrationPatch?.codeAgentWipExecutionV1 ?? wip;
          if (persistPatch.orchestration.kind === "completed") {
            await tryAutoPlatformScmMergeAfterPush(updatedWip);
          }
        } catch (error) {
        }
      })();
    },
    [applyPlatformScmExecutorJson, persistPlatformScmOrchestrationPatch, tryAutoPlatformScmMergeAfterPush],
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
        applyMessages: () => {},
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
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      applyImplementationOrchestrationResult,
      executePlatformScmAfterRequest,
      canApplyGit,
    ],
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
    applyImplementationOrchestrationResult({
      orchestrationPatch: result.orchestrationPatch,
    });
    appendAiNoticeForImplementation(String(result.message.content ?? "").trim());
  }, [
    projectId,
    parsedRequirementsState.singleChatOrchestrationV1,
    parsedRequirementsState.promptTimeline,
    planningSlotDefinitions,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
    appendAiNoticeForImplementation,
  ]);

  const runImplementationQualityGate = useCallback(
    (role: "reviewer" | "security"): ImplementationStageActionRunResult => {
      const orchestration = orchestrationAwareRequirementsState;
      const taskList = orchestration.implementationTaskListV1;
      const pid = projectId.trim();
      if (!taskList || !pid) {
        const message = "구현 작업목록이 없어 점검을 실행할 수 없습니다.";
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
    [orchestrationAwareRequirementsState, projectId, persistChatToDb],
  );

  const runFinalScmIntegratedStageStep = useCallback((): ImplementationStageActionRunResult => {
    const pid = projectId.trim();
    if (!pid) {
      const message = "프로젝트를 선택해 주세요.";
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
      return { outcome: "blocked", message: readiness.message };
    }

    const taskList = parsedRequirementsState.implementationTaskListV1;
    if (!taskList) {
      const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
      return { outcome: "blocked", message };
    }

    const boardBefore = buildImplementationExecutionBoardFromRequirementsState({
      projectId: pid,
      orchestration: parsedRequirementsState,
    });
    if (!boardBefore) {
      const message = "구현 실행 보드를 만들 수 없습니다.";
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
              persistPatch.orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsStateJsonRef.current),
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendAiNoticeForImplementation(buildFinalScmIntegratedStageFailedNotice(message));
      }
    })();

    return { outcome: "executed" };
  }, [
    projectId,
    orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    parsedRequirementsState,
    applyImplementationOrchestrationResult,
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
      return readiness.noOp
        ? { outcome: "no_op", message: readiness.message }
        : { outcome: "blocked", message: readiness.message };
    }
    void (async () => {
      try {
        const persistPatch = await applyPlatformScmMergeExecutorJson({ wip: wip!, autoMergeOnly: false });
        persistPlatformScmMergePatch(persistPatch);
      } catch (error) {
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
        return { outcome: "blocked", message };
      }
      const taskList = parsedRequirementsState.implementationTaskListV1;
      if (!taskList) {
        const message = "구현 작업목록이 없어 통합 단계를 실행할 수 없습니다.";
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
      appendImplementationTaskListAiMessage,
      prototypeRunSyncSnapshot.previewReady,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      executionSetupRow,
    ],
  );

  const mergeIntegrationPullRequest = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) {
      return;
    }
    void (async () => {
      setIntegrationMergeBusy(true);
      try {
        const result = await mergeIntegrationPullRequestClient({ projectId: pid });
        if (result.ok) {
        } else {
        }
      } catch (error) {
      } finally {
        setIntegrationMergeBusy(false);
      }
    })();
  }, [projectId]);

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
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      previewUrl,
      latestRun?.previewUrl,
      latestRun?.suggestedPreviewUrl,
    ],
  );

  const runIntegrationPipeline = useCallback(() => {
    if (!implementationBoard) {
      return;
    }
    void executeImplementationBoardIntegrationPipeline({
      projectId,
      projectName,
      requirementsState: parsedRequirementsState,
      requirementsStateJsonRef,
      implementationBoardBlockingUserConfirmation:
        implementationBoard.summary.blockingUserConfirmation,
      boardSelectionSummary: boardSelectionBridge.getBridgeSnapshot().livePanelSummary,
      persistChatToDb,
      applyPendingFromOrchestrationPatch,
      setBusy: setIntegrationPipelineBusy,
      onClientResult: setIntegrationPipelineClientResult,
    });
  }, [
    projectId,
    projectName,
    implementationBoard,
    parsedRequirementsState,
    persistChatToDb,
    applyPendingFromOrchestrationPatch,
    showToast,
    boardSelectionBridge,
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
      return { outcome: "blocked", message: result.message };
    }
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    applyImplementationOrchestrationResult({
      messages: [...(resolved.messages ?? []), ...result.messages],
      orchestrationPatch: result.orchestrationPatch,
    });
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
          return;
        }
        applyImplementationOrchestrationResult({
          messages: json.data.messages ?? [],
          orchestrationPatch: (json.data.orchestrationPatch ?? {}) as PrototypeExecutionOrchestrationPersistInput,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Quick Design 확정 처리 중 오류가 발생했습니다.";
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
        return;
      }
      void persistChatToDb(
        resolvePrototypeExecutionSingleChatFromState(requirementsStateJson),
        result.patch,
      );
      for (const message of result.messages) {
        appendImplementationTaskListAiMessage(message);
      }
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
          return { outcome: "blocked", message };
        }
        case "SHOW_IMPLEMENTATION_RUNTIME_DIAGNOSTICS": {
          void loadImplementationRuntimeDb({ recover: false });
          return { outcome: "executed" };
        }
        case "RELEASE_IMPLEMENTATION_EXECUTION_LOCK": {
          const message =
            "실행 잠금 해제는 비활성화되었습니다. 필요 시 선택 CodeTask 실행을 다시 시작하세요.";
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
        case "SHOW_ARTIFACTS": {
          const message =
            "구현 산출물 Hub는 제공되지 않습니다. 기획(/requirements) 화면에서 산출물을 확인해 주세요.";
          return { outcome: "blocked", message };
        }
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
              applyMessages: () => {},
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
          } else {
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
              return { outcome: prep.outcome, message: prep.message };
            }
            const { prepared } = prep;
            const codeTaskTitle = codeTaskPlan?.tasks.find(
              (t) => t.codeTaskId === prepared.codeTaskId,
            )?.title;
            applyImplementationOrchestrationResult(
              {
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
                  return;
                }
                const notice =
                  json.message ??
                  (json.success ? `${userStatus.label} 처리되었습니다.` : "CodeTask 실행에 실패했습니다.");
                if (!json.success && !json.pollRequired && !preflightFailure) {
                  applyImplementationOrchestrationResult({
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
                  messages: readImplementationStageChatMessages(requirementsStateJsonRef.current),
                  orchestrationPatch,
                });
                appendAiNoticeForImplementation(`CodeTask 실행 오류: ${friendly}`);
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
                return;
              }

              const notice =
                json.execution?.errorMessage ??
                json.message ??
                (json.success ? "Task Cursor 실행이 완료되었습니다." : "Task Cursor 실행에 실패했습니다.");
              if (!json.success && !json.pollRequired && !preflightFailure) {
                applyImplementationOrchestrationResult({
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
                messages: readImplementationStageChatMessages(requirementsStateJsonRef.current),
                orchestrationPatch,
              });
              appendAiNoticeForImplementation(`Task Cursor 실행 오류: ${friendly}`);
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
              appendImplementationExecutionNotice(notice);
              void fetchImplementationRuntime(pid).then((fetched) => {
                if (fetched.success) applyImplementationRuntimeFetch(fetched);
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
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
                  messages: orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsStateJsonRef.current),
                  orchestrationPatch: orchestration.orchestrationPatch,
                });
              } else {
                appendAiNoticeForImplementation(message);
              }
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
                    messages: orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsStateJsonRef.current),
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
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_OPEN_PREVIEW": {
          const url = previewUrl ?? prototypeRunSyncSnapshot.previewUrl;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            return { outcome: "executed" };
          }
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
            return { outcome: "blocked", message };
          }
          const active = getActiveReviewFeedbackItems(
            parsedRequirementsState.reviewStageUserFeedbackListV1,
          );
          const feedback = active[0];
          if (!feedback) {
            const message = "구현단계로 전환할 미처리 피드백이 없습니다.";
            return { outcome: "blocked", message };
          }
          const fallbackTaskId =
            pickFirstExecutableDeveloperTaskId(board) ??
            board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId ??
            "";
          if (!fallbackTaskId) {
            const message = "보완 요청을 연결할 developer 작업이 없습니다.";
            return { outcome: "blocked", message };
          }
          const feedbackList = parsedRequirementsState.reviewStageUserFeedbackListV1;
          if (!feedbackList) {
            const message = "피드백 목록이 없습니다.";
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
          return { outcome: "executed" };
        }
        case "REVIEW_STAGE_COMPLETE_TEST": {
          const completeGate = canCompleteReviewStage({
            feedbackList: parsedRequirementsState.reviewStageUserFeedbackListV1,
          });
          if (!completeGate.ok) {
            return { outcome: "blocked", message: completeGate.message };
          }
          const session = parsedRequirementsState.reviewStageUserTestSessionV1;
          if (!session) {
            const message = "사용자 테스트 세션이 없습니다. 먼저 사용자 테스트를 시작해 주세요.";
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
        return;
      }
      void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), result.patch);
      for (const message of result.messages) {
        appendImplementationTaskListAiMessage(message);
      }
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
        } else if (run.status === "failed" && run.message) {
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
    ],
  );

  const handleRestartBoardTask = useCallback(
    (taskId: string) => {
      const pid = projectId.trim();
      const board = implementationStageBoardGateContext?.board;
      if (!pid || !board) {
        return;
      }
      const row = board.taskRows.find((item) => item.taskId === taskId);
      if (!row) {
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
        return;
      }
      const envGate = resolveTaskCursorExecutionEnvGate({ setup: executionSetupRow });
      if (envGate.blocked) {
        appendAiNoticeForImplementation(envGate.message ?? "환경설정 점검이 필요합니다.");
        return;
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
        orchestrationPatch: {
          implementationExecutionBoardStateV1: nextBoardState,
        },
      });
    },
    [
      projectId,
      parsedRequirementsState.implementationExecutionBoardStateV1,
      applyImplementationOrchestrationResult,
      readImplementationStageChatMessages(requirementsStateJsonRef.current),
    ],
  );

  const handleBoardSelectedCodeTaskIdsChange = useCallback(
    (selectedCodeTaskIds: readonly string[]) => {
      const pid = projectId.trim();
      if (!pid) return;
      boardSelectionBridge.recordPersistedBoardSelection(selectedCodeTaskIds);
      const nowIso = new Date().toISOString();
      const nextBoardState = updateBoardCheckedCodeTaskIds({
        state:
          orchestrationAwareRequirementsStateRef.current.implementationExecutionBoardStateV1,
        projectId: pid,
        checkedCodeTaskIds: selectedCodeTaskIds,
        nowIso,
      });
      applyPendingFromOrchestrationPatchRef.current({
        implementationExecutionBoardStateV1: nextBoardState,
      });
      applyImplementationOrchestrationResult(
        {
        orchestrationPatch: {
            implementationExecutionBoardStateV1: nextBoardState,
          },
        },
        { persist: true, forcePersist: true },
      );
    },
    [
      projectId,
      applyImplementationOrchestrationResult,
      readImplementationStageChatMessages(requirementsStateJsonRef.current),
      boardSelectionBridge.recordPersistedBoardSelection,
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
        showImplementationSeedReadinessCheck,
        returnToPlanningStage: () => {
          const pid = projectId.trim();
          if (!pid) return;
          window.location.assign(`/requirements?projectId=${encodeURIComponent(pid)}`);
        },
        focusComposerForScopeEdit: () => {
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
    ],
  );


  const onPickImplementationInterviewLabel = useCallback(
    (label: string) => {
      if (handleImplementationChip(label)) return;
    },
    [handleImplementationChip],
  );

  const startImplementationQuickRun = useCallback(async (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }): Promise<ImplementationStageActionRunResult> => {
    const pid = projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트 ID가 없습니다." };
    const imp = orchestrationAwareRequirementsStateRef.current;
    const bridge = boardSelectionBridge.getBridgeSnapshot();
    const prepEval = evaluateImplementationQuickRunPrepAndSelection({
      projectId: pid,
      requirementsState: imp,
      selectedCodeTaskIdsOverride: options?.selectedCodeTaskIds,
      bridge,
    });
    if (!prepEval.ok) {
      if (prepEval.kind === "mock_id_blocked") {
        recordQuickRunClientEvent({
          phase: "quick_run_selected_mock_id_blocked",
          detail: prepEval.message,
          selectedCount: 0,
        });
        const blockedTimeline = appendPromptTimeline(imp.promptTimeline, prepEval.timelineEntry);
        applyPendingFromOrchestrationPatchRef.current({ promptTimeline: blockedTimeline });
        void persistChatToDb(undefined, { promptTimeline: blockedTimeline }, undefined, { force: true });
        return { outcome: "blocked", message: prepEval.message };
      }
      recordQuickRunClientEvent({
        phase: prepEval.phase,
        detail: prepEval.message,
        selectedCount: prepEval.selectedCount,
      });
      return { outcome: "blocked", message: prepEval.message };
    }
    if (prepEval.repairs.length) {
      const nowIso = new Date().toISOString();
      const repairEntries = buildRepairTimelineEntries({
        projectId: pid,
        repairs: prepEval.repairs,
        nowIso,
      });
      let repairTimeline = imp.promptTimeline;
      for (const entry of repairEntries) {
        repairTimeline = appendPromptTimeline(repairTimeline, entry);
      }
      applyPendingFromOrchestrationPatchRef.current({ promptTimeline: repairTimeline });
      void persistChatToDb(undefined, { promptTimeline: repairTimeline }, undefined, { force: true });
    }
    const jobSelectedCodeTaskIds = prepEval.selectedRunnableCodeTaskIds;
    recordQuickRunClientEvent({
      phase: "start_implementation_quick_run",
      detail: jobSelectedCodeTaskIds.length
        ? `selected=${jobSelectedCodeTaskIds.join(",")}`
        : "selected=none",
      selectedCount: jobSelectedCodeTaskIds.length,
    });
    quickRunStuckGithubVerifyRef.current = null;
    quickRunCodeTaskContinuationRef.current = null;
    dbQueuedQuickRunDispatchRef.current = null;
    const nowIso = new Date().toISOString();
    const quickRunPrepared = prepareRequirementsStateForImplementationQuickRun({
      projectId: pid,
      requirementsState: imp,
      nowIso,
    });
    const impForQuickRun = quickRunPrepared.requirementsState;
    const quickRunPrepPersistPatch = buildImplementationQuickRunRequirementsPrepPersistPatch({
      prepared: quickRunPrepared,
    });
    if (Object.keys(quickRunPrepPersistPatch).length) {
      applyPendingFromOrchestrationPatchRef.current(quickRunPrepPersistPatch);
      await persistChatToDb(undefined, quickRunPrepPersistPatch, undefined, {
        awaitServer: true,
        force: true,
      });
    }
    const queueItems = buildImplementationQuickRunQueueItems({
      selectedCodeTaskIds: jobSelectedCodeTaskIds,
      requirementsState: impForQuickRun,
    });
    const startJobRes = await postImplementationQuickRunStartJob({
      projectId: pid,
      selectedCodeTaskIds: jobSelectedCodeTaskIds,
      queueItems,
    });
    if (!startJobRes.success) {
      const message = startJobRes.message ?? "DB Runtime Job 시작에 실패했습니다.";
      recordQuickRunClientEvent({
        phase: "start_job_failed",
        detail: message,
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
      return { outcome: "blocked", message };
    }
    const orchestration = buildQuickRunOrchestrationAfterJobStart({
      projectId: pid,
      jobSelectedCodeTaskIds,
      firstCodeTaskId,
      requirementsState: impForQuickRun,
      requirementsStateJsonRaw: requirementsStateJsonRef.current,
      executionSetup: executionSetupRow,
      nowIso,
    });
    if ("ok" in orchestration) {
      return { outcome: "blocked", message: orchestration.message };
    }
    const orch = orchestration;
    const { quickRun, codeTaskExecutionRunsV1, runtimeUiSnapshotPatch, dispatchTarget } = orch;
    applyImplementationOrchestrationResult(
      {
        orchestrationPatch: {
          implementationQuickRunV1: quickRun,
          codeTaskExecutionRunsV1,
          implementationRuntimeUiSnapshotV1: runtimeUiSnapshotPatch,
        },
      },
      { persist: false },
    );
    codeTaskDispatchPreferredTaskIdRef.current = dispatchTarget.parentTaskId;
    const dbRunId = runtimeBundle.currentRun?.id?.trim() ?? "";
    if (dbRunId) {
      dbQueuedQuickRunDispatchRef.current = `${dbRunId}:${dispatchTarget.codeTask.codeTaskId}`;
    }
    void continueImplementationQuickRunAfterStart({
      projectId: pid,
      imp,
      startJobRes,
      orchestration: orch,
      nowIso,
      enrichOrchestrationPatch: enrichCodeTaskRunOrchestrationPatch,
      onDispatchPatch: (patch) => {
        applyImplementationOrchestrationResult({
        orchestrationPatch: patch,
        });
      },
      persistAfterStart: async (patch) => {
        await persistChatToDb(
          resolvePrototypeExecutionSingleChatFromState(requirementsStateJson),
          patch,
          undefined,
          { awaitServer: true, force: true },
        );
      },
      persistDispatchTimeline: (entry) => {
        void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
          promptTimeline: appendPromptTimeline(imp.promptTimeline, entry),
        });
      },
      onRuntimeBundle: setImplementationRuntimeDbBundle,
      reloadRuntime: () => {
        void loadImplementationRuntimeDb({ recover: false });
      },
      clearDbQueuedDispatchKey: () => {
        dbQueuedQuickRunDispatchRef.current = null;
      },
    });
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
    executionSetupRow,
    boardSelectionBridge,
  ]);

  useEffect(() => {
    startImplementationQuickRunRef.current = () => {
      const pid = projectId.trim();
      const imp = orchestrationAwareRequirementsStateRef.current;
      const bridgeSnap = boardSelectionBridge.getBridgeSnapshot();
      const selectedCodeTaskIds = resolveCheckedCodeTaskIdsFromBoardBridge({
        bridge: bridgeSnap,
        requirementsState: imp,
      });
      void startImplementationQuickRun({ selectedCodeTaskIds });
    };
  }, [startImplementationQuickRun, projectId, boardSelectionBridge]);

  const handleCopyCodeTaskCursorPrompt = useCallback(
    (codeTaskId: string) => {
      const pid = projectId.trim();
      const id = codeTaskId.trim();
      if (!pid || !id) return;
      const prepared = prepareRequirementsStateForImplementationQuickRun({
        projectId: pid,
        requirementsState: orchestrationAwareRequirementsState,
      });
      const imp = prepared.requirementsState;
      const prepPatch = buildImplementationQuickRunRequirementsPrepPersistPatch({ prepared });
      if (Object.keys(prepPatch).length) {
        applyPendingFromOrchestrationPatchRef.current(prepPatch);
        void persistChatToDb(undefined, prepPatch, undefined, { force: true });
      }
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: executionSetupRow?.gitRepoUrl,
        gitRepoName: executionSetupRow?.gitRepoName,
        gitRepoProvider: executionSetupRow?.gitRepoProvider,
        baseBranch: executionSetupRow?.baseBranch,
      });
      const runs =
        parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ??
        [];
      const result = resolveCodeTaskDeveloperPromptForCopy({
        projectId: pid,
        codeTaskId: id,
        codeTaskPlan: imp.implementationCodeTaskPlanV1 ?? null,
        taskList: imp.implementationTaskListV1 ?? null,
        cursorWorkItems: imp.cursorWorkItemsV1 ?? [],
        runs,
        targetRepository,
        baseBranch: executionSetupRow?.baseBranch ?? targetRepository?.defaultBranch ?? "main",
        allowedPathGlobs: parseStringArrayJson(executionSetupRow?.allowedPathGlobs),
        codeTaskPromptContextMapV1: imp.codeTaskPromptContextMapV1 ?? null,
      });
      if (!result.ok || !result.prompt) {
        return;
      }
      void writeClipboardText(result.prompt).then((ok) => {
      });
    },
    [
      projectId,
      executionSetupRow,
      orchestrationAwareRequirementsState,
      applyPendingFromOrchestrationPatchRef,
      persistChatToDb,
    ],
  );

  const handleCopyDeveloperPromptsFromHeader = useCallback(() => {
    const pid = projectId.trim();
    if (!pid) return;
    const prepared = prepareRequirementsStateForImplementationQuickRun({
      projectId: pid,
      requirementsState: orchestrationAwareRequirementsState,
    });
    const imp = prepared.requirementsState;
    const prepPatch = buildImplementationQuickRunRequirementsPrepPersistPatch({ prepared });
    if (Object.keys(prepPatch).length) {
      applyPendingFromOrchestrationPatchRef.current(prepPatch);
      void persistChatToDb(undefined, prepPatch, undefined, { force: true });
    }
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: executionSetupRow?.gitRepoUrl,
      gitRepoName: executionSetupRow?.gitRepoName,
      gitRepoProvider: executionSetupRow?.gitRepoProvider,
      baseBranch: executionSetupRow?.baseBranch,
    });
    const selectedCodeTaskIds = resolveCheckedCodeTaskIdsFromBoardBridge({
      bridge: boardSelectionBridge.getBridgeSnapshot(),
      requirementsState: imp,
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
      return;
    }
    const totalCodeTaskCount = plan?.tasks?.length ?? 0;
    void writeClipboardText(result.prompt).then((ok) => {
    });
  }, [
    projectId,
    orchestrationAwareRequirementsState,
    executionSetupRow,
    implementationRuntimeDbBundle?.job?.currentCodeTaskId,
    boardSelectionBridge,
    applyPendingFromOrchestrationPatchRef,
    persistChatToDb,
    showToast,
  ]);

  const onOpenExecutionEnvironmentSettings = useCallback(() => {
    setExecutionEnvironmentModalOpen(true);
  }, []);

  const onOpenImplementationExecutionLog = useCallback(() => {
    setImplementationExecutionLogModalOpen(true);
  }, []);

  const onClearImplementationExecutionLog = useCallback(() => {
    const imp = orchestrationAwareRequirementsStateRef.current;
    const current = imp.promptTimeline ?? [];
    const next = stripExecutionLogTimelineEntries(current);
    if (next.length === current.length) return;
    applyPendingFromOrchestrationPatchRef.current({ promptTimeline: next });
    void persistChatToDb(undefined, { promptTimeline: next }, undefined, { force: true });
  }, [persistChatToDb]);

  const executionConversationIconToolbar = useMemo(
    () => (
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
      </>
    ),
    [
      onOpenExecutionEnvironmentSettings,
      onOpenImplementationExecutionLog,
    ],
  );

  const planningOrchestrationView = useMemo(
    () =>
      buildPrototypeExecutionPlanningOrchestrationView({
        requirementsStateJson,
        projectId,
        projectName: projectName || "프로젝트",
        projectDescription,
        servicePlanningAgentCatalogKeys,
      }),
    [requirementsStateJson, projectId, projectName, projectDescription, servicePlanningAgentCatalogKeys],
  );

  const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false);
  const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null);

  const openDeliverableViewer = useCallback((ids: readonly string[], focusId?: string | null) => {
    setDeliverableViewerFocusId(focusId ?? ids[0] ?? null);
    setDeliverableViewerOpen(true);
  }, []);

  const closeDeliverableViewer = useCallback(() => {
    setDeliverableViewerOpen(false);
  }, []);

  const recommendationEvidence = useProjectRecommendationEvidence({
    projectId,
    requirementsStateJson: parsedRequirementsState,
    projectArtifacts: planningOrchestrationView.projectArtifacts,
    projectDescription,
  });

  const deliverableViewer = useMemo(
    () => ({
      open: deliverableViewerOpen,
      focusAssetId: deliverableViewerFocusId,
      openDeliverables: openDeliverableViewer,
      close: closeDeliverableViewer,
    }),
    [deliverableViewerOpen, deliverableViewerFocusId, openDeliverableViewer, closeDeliverableViewer],
  );

  return {
    planningOrchestrationView,
    recommendationEvidence,
    deliverableViewer,
    onPickImplementationInterviewLabel,
    orchestrationAwareRequirementsState,
    executionConversationIconToolbar,
    implementationBoard,
    implementationStageBoardInput,
    prototypeRunSyncSnapshot,
    effectiveCodeTaskExecutionQueueV1,
    boardSelectionBridge,
    activeTaskCursorJob,
    handleRestartBoardTask,
    handleBoardSelectedTaskIdsChange,
    handleBoardSelectedCodeTaskIdsChange,
    handleCopyCodeTaskCursorPrompt,
    handleCopyDeveloperPromptsFromHeader,
    handleManualGithubVerifyRetry,
    handleRecheckCodeTaskGithubVerify,
    githubRecheckBusyCodeTaskId,
    handleRetryFailedCodeTask,
    implementationRuntimeDbBundle,
    runIntegrationPipeline,
    integrationPipelineBusy,
    mergeIntegrationPullRequest,
    integrationMergeBusy,
    integrationPipelineClientResult,
    openImplementationPreview,
    startImplementationQuickRun,
    orchestrationAwareRequirementsStateRef,
    implementationBootstrapShell,
    implementationStageNoticeModal,
    setImplementationStageNoticeModal,
    implementationExecutionLogModalOpen,
    setImplementationExecutionLogModalOpen,
    onClearImplementationExecutionLog,
    handleExecutionSetupChanged,
    latestRunForDevTools: latestRun,
    executionSlotsForDevTools: executionSlots,
  };
}
