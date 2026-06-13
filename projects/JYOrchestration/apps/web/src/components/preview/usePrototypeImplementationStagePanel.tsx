"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PrototypeChatAction } from "@/lib/prototype/buildPrototypeChatMessages";
import { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import { useImplementationControlPlaneSnapshot } from "@/components/preview/useImplementationControlPlaneSnapshot";
import {
  useImplementationIntegrationPipelineController,
  type ImplementationIntegrationPipelineClientResultV1,
} from "@/components/preview/useImplementationIntegrationPipelineController";
import { useImplementationGithubVerifyController } from "@/components/preview/useImplementationGithubVerifyController";
import { useImplementationQuickRunController, persistImplementationQuickRunRequirementsPrep } from "@/components/preview/useImplementationQuickRunController";
import { useImplementationStageActionController } from "@/components/preview/useImplementationStageActionController";
import { useImplementationStageActionLegacyDispatchBundle } from "@/components/preview/useImplementationStageActionLegacyDispatchBundle";
import { useImplementationStageActionOrchestrator } from "@/components/preview/useImplementationStageActionOrchestrator";
import { useImplementationBoardInteractionController } from "@/components/preview/useImplementationBoardInteractionController";
import { useImplementationChipHandlerController } from "@/components/preview/useImplementationChipHandlerController";
import { useImplementationPreviewController } from "@/components/preview/useImplementationPreviewController";
import { useImplementationFinalScmController } from "@/components/preview/useImplementationFinalScmController";
import { useImplementationRuntimeDbSync } from "@/components/preview/useImplementationRuntimeDbSync";
import { useDbQueuedQuickRunAutoDispatch } from "@/components/preview/useDbQueuedQuickRunAutoDispatch";
import { useApplyImplementationOrchestrationResult } from "@/components/preview/useApplyImplementationOrchestrationResult";
import { usePrototypeExecutionPersistChatToDb } from "@/components/preview/usePrototypeExecutionPersistChatToDb";
import { useImplementationStageActionTimeline } from "@/components/preview/useImplementationStageActionTimeline";
import { useRecoverServerQuickRunContinuation } from "@/components/preview/useRecoverServerQuickRunContinuation";
import { useTaskCursorServerJobPoll } from "@/components/preview/useTaskCursorServerJobPoll";
import { useImplementationAutoQualityGateTrigger } from "@/components/preview/useImplementationAutoQualityGateTrigger";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";

import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import {
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
} from "@/lib/requirements/implementationUxLabels";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import {
  buildImplementationBootstrapInput,
  pickExecutionStateArtifacts,
  toPrototypeChatEnvSnapshot,
} from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import {
  buildQualityGateBridgeTargetFromTaskCursor,
  buildQualityGateBridgeTargetFromWip,
} from "@/lib/prototype/bridgeCompletionPolicy";
import { buildTargetRepoE2eTimelineEntry } from "@/lib/prototype/targetRepoE2eDiagnostics";
import { buildWipChipHandlerSlice } from "@/lib/prototype/prototypeExecutionWipChipHandlers";
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
  mergePendingImplementationPatch,
  mergePendingImplementationPatchFromOrchestration,
  resolveOrchestrationAwareRequirementsState,
  resolveEffectiveImplementationState,
  shouldClearPendingImplementationPatch,
  type ImplementationStageActionId,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { hasActiveImplementationExecutionSession } from "@/lib/requirements/resetDerivedImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import {
  prioritizeImplementationChipsForState,
  deriveImplementationStageNextActions,
} from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  buildConfirmImplementationTaskPlanResult,
  buildImplementationCursorGateContext,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildImplementationRoleCheckSummary,
  buildImplementationStatusQueryMessage,
  buildImplementationStatusQueryTimelineEntry,
  hasImplementationRoleCheckDetailsShown,
  implementationEntryChipsForBootstrap,
  buildImplementationBootstrapShellView,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { appendCreateWorkPlanBootstrapCtaRouteTimeline } from "@/lib/prototype/implementationIntentTimeline";
import { summarizeImplementationSeedStatus } from "@/lib/requirements/implementationSeed";
import {
  postImplementationPrepSync,
  postQuickDesignConfirm,
} from "@/components/project-spec/apis/quickDesignConfirmApi";
import { buildCreateImplementationSeedFromQuickDesignDraftResult } from "@/lib/prototype/implementationQuickDesignDraftBridge";
import {
  buildImplementationEntryCursorWorkItemsRecovery,
  buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry,
} from "@/lib/prototype/implementationEntryState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildIntegratedStageStepActionNotice,
  pickQualityGateTargetTaskIds,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { isLegacyCodeTaskPreviewScopeNoticeContent } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION } from "@/lib/prototype/implementationPreviewActionSource";
import { isLegacyContinuePreviewMessage } from "@/lib/prototype/implementationIntegrationToastPolicy";
import {
  buildImplementationExecutionBoardMessage,
  buildImplementationBoardRefreshSyncKey,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  dedupeImplementationStageNextActions,
  extractBoardVisibleActionLabels,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import { resolveCheckedCodeTaskIdsFromBoardBridge } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import {
  finalizeIntegratedStageStep,
  type ImplementationIntegratedStep,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import {
  readImplementationStageChatMessages,
  readImplementationStageChatPatch,
} from "@/lib/prototype/implementationStageChatSnapshot";
import { shouldSuppressImplementationStatusMessage } from "@/lib/prototype/implementationStatusChatPolicy";
import { resolveDeveloperPromptCopyFromSelection } from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import {
  shouldSyncExecutionStateAfterTaskCursorGithubVerify,
  syncTaskExecutionStateAfterGithubVerified,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { resolveCodeTaskRunForAutoQualityGateClient } from "@/lib/prototype/implementationAutoQualityGateClient";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  pickPersistentExecutionLogTimelineEntries,
  stripExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { resolvePersistedQueueDispatch } from "@/lib/prototype/implementationRuntimePanelBridge";
import { readActiveRuntimeDispatchFromState } from "@/lib/prototype/implementationRuntimeSync";
import {
  postImplementationRuntimeAction,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { computePrototypeExecutionSlots } from "@/lib/prototype/prototypeExecutionSlots";
import {
  PROTOTYPE_TEMPLATES,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

import type {
  MutableRefObject,
  ReactNode,
  RefObject,
} from "react";

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
  implementationControlPlaneSnapshot: ReturnType<typeof useImplementationControlPlaneSnapshot>;
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

  const integrationPipelineClientResultRef = useRef<ImplementationIntegrationPipelineClientResultV1 | null>(
    null,
  );
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

  // Parent-level controlPlaneSnapshot is a toolbar/dispatch fallback based on bridge summary.
  // ImplementationExecutionBoardPanel rebuilds a local snapshot from live taskTreeNodes
  // and uses local snapshot as the authoritative UI/footer snapshot.
  const implementationControlPlaneSnapshot = useImplementationControlPlaneSnapshot({
    projectId,
    selectionSummary: boardSelectionBridge.liveCodeTaskSelectionSummary,
    previewReady: prototypeRunSyncSnapshot.previewReady,
    actualPreviewUrl: prototypeRunSyncSnapshot.previewUrl ?? null,
    runtime: {
      hasDbRuntimeJob: Boolean(implementationRuntimeDbBundle?.job),
      currentCodeTaskId: implementationRuntimeDbBundle?.job?.currentCodeTaskId?.trim() ?? null,
      currentRuntimeState: implementationRuntimeDbBundle?.job?.state?.trim() ?? null,
      shouldPoll: !implementationRuntimePollSuspendedRef.current,
    },
  });

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
    (
      actionId: ImplementationStageActionId,
    ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >(() => ({ outcome: "blocked", message: "구현단계 action을 준비하는 중입니다." }));
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

  const appendUserNotice = useCallback(
    (message: string) => {
      const text = String(message ?? "").trim();
      if (text) appendAiNoticeForImplementation(text);
    },
    [appendAiNoticeForImplementation],
  );

  /** 통합 파이프라인 결과는 integratedReady 억제 없이 항상 모달로 표시 */
  const showIntegrationPipelineUserNotice = useCallback((message: string) => {
    const text = String(message ?? "").trim();
    if (!text) return;
    setImplementationStageNoticeModal({ body: text });
  }, []);

  const {
    integrationPipelineBusy,
    integrationPipelineClientResult,
    runIntegrationPipeline,
  } = useImplementationIntegrationPipelineController({
    projectId,
    projectName,
    boardSelectionBridge,
    parentControlPlaneSnapshot: implementationControlPlaneSnapshot,
    requirementsState: parsedRequirementsState,
    requirementsStateJsonRef,
    implementationBoardBlockingUserConfirmation:
      implementationBoard?.summary.blockingUserConfirmation ?? null,
    persistChatToDb,
    applyPendingFromOrchestrationPatch,
    showIntegrationPipelineUserNotice,
    integrationPipelineClientResultRef,
  });

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

  const {
    githubRecheckBusyCodeTaskId,
    recoverQuickRunStuckGithubVerify,
    handleManualGithubVerifyRetry,
    handleRecheckCodeTaskGithubVerify,
  } = useImplementationGithubVerifyController({
    projectId,
    requirementsStateJsonRef,
    effectiveCodeTaskExecutionQueueV1,
    implementationRuntimeDbBundle,
    executionSetupRow,
    implementationStageBoardInput,
    orchestrationAwareRequirementsState,
    quickRunStuckGithubVerifyRef,
    quickRunCodeTaskContinuationRef,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationOrchestrationResult,
    dispatchNextQuickRunFromGithubVerify,
    appendUserNotice,
    appendImplementationExecutionNotice,
    applyImplementationRuntimeFetch,
    loadImplementationRuntimeDb,
    runFallbackVerifyAction: () => {
      runImplementationStageActionRef.current("VERIFY_TASK_CURSOR_GITHUB");
    },
  });

  const { startImplementationQuickRun } = useImplementationQuickRunController({
    projectId,
    requirementsStateJson,
    requirementsStateJsonRef,
    orchestrationAwareRequirementsStateRef,
    boardSelectionBridge,
    executionSetupRow,
    quickRunStuckGithubVerifyRef,
    quickRunCodeTaskContinuationRef,
    dbQueuedQuickRunDispatchRef,
    codeTaskDispatchPreferredTaskIdRef,
    setImplementationRuntimeDbBundle,
    loadImplementationRuntimeDb,
    recordQuickRunClientEvent,
    applyPendingFromOrchestrationPatchRef,
    applyImplementationOrchestrationResult,
    enrichCodeTaskRunOrchestrationPatch,
    persistChatToDb,
    appendUserNotice,
  });

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
    appendUserNotice,
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
    appendUserNotice,
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
    appendUserNotice,
  ]);

  const {
    executePlatformScmAfterRequest,
    runFinalScmIntegratedStageStep,
    runPlatformScmMergeStep,
  } = useImplementationFinalScmController({
    projectId,
    parsedRequirementsState,
    requirementsStateJsonRef,
    orchestrationAwareRequirementsState,
    executionSetupRow,
    prototypeRunSyncSnapshot,
    applyImplementationOrchestrationResult,
    persistChatToDb,
    appendAiNoticeForImplementation,
    appendImplementationTaskListAiMessage,
  });

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
        appendUserNotice,
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
      appendAiNoticeForImplementation,
      prototypeRunSyncSnapshot.previewReady,
      orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      executionSetupRow,
      runFinalScmIntegratedStageStep,
    ],
  );

  const {
    integrationMergeBusy,
    mergeIntegrationPullRequest,
    openImplementationPreview,
  } = useImplementationPreviewController({
    projectId,
    previewUrl,
    latestRunPreviewUrl: latestRun?.previewUrl ?? null,
    latestRunSuggestedPreviewUrl: latestRun?.suggestedPreviewUrl ?? null,
    orchestrationAwareRequirementsStateRef,
    applyPendingFromOrchestrationPatch,
    persistChatToDb,
  });

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
    appendUserNotice,
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
    appendUserNotice,
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
    appendUserNotice,
  ]);

  const legacyDispatch = useImplementationStageActionLegacyDispatchBundle({
    projectId,
    generateImplementationTaskList,
    confirmQuickDesignForImplementation,
    createImplementationSeedFromQuickDesignDraft,
    loadImplementationRuntimeDb,
    generateImplementationWorkPlanDraft,
    confirmImplementationTaskPlan,
    reviewDbIntegrationNeed,
    generateDataModelDraft,
    confirmMockImplementationMode,
    applyImplementationStageActionExecutionResult,
    refreshExecutionEnvironmentStatus,
    runImplementationQualityGate,
    runIntegratedStageStep,
    runFinalScmIntegratedStageStep,
    runPlatformScmMergeStep,
    parsedRequirementsState,
    previewUrl,
    prototypeRunSyncSnapshot,
    executionSetupRow,
    persistChatToDb,
    appendAiNoticeForImplementation,
    appendUserNotice,
    appendImplementationTaskListAiMessage,
    pendingImplementationPatch,
    effectiveImplementationState,
    executionArtifacts,
    orchestrationAwareRequirementsState,
    requirementsStateJson,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatch,
    implementationCursorGate,
    implementationStageBoardGateContext,
    boardManualPickTaskIdRef,
    codeTaskDispatchPreferredTaskIdRef,
    pendingQuickRunQueueDispatchRef,
    quickRunCodeTaskContinuationRef,
    requirementsStateJsonRef,
    dispatchNextQuickRunFromGithubVerify,
    appendImplementationExecutionNotice,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationRuntimeFetch,
    persistedQueueDispatch,
    wipChipHandlers,
    setExecutionEnvironmentModalOpen,
  });

  const executeCodeTasks = useCallback(
    async (executeInput: { readonly codeTaskIds: readonly string[]; readonly source: string }) => {
      if (!executeInput.codeTaskIds.length) {
        return { outcome: "blocked", message: "실행할 CodeTask를 선택해 주세요." };
      }
      return startImplementationQuickRun({ selectedCodeTaskIds: executeInput.codeTaskIds });
    },
    [startImplementationQuickRun],
  );

  const openPreviewFromStageAction = useCallback(() => {
    const url = String(
      implementationControlPlaneSnapshot?.preview.actualPreviewUrl ?? previewUrl ?? "",
    ).trim();
    if (!url) {
      appendUserNotice("Preview URL을 확인할 수 없습니다.");
      return;
    }
    openImplementationPreview({ mode: "integrated_app_preview", url });
  }, [
    implementationControlPlaneSnapshot,
    previewUrl,
    openImplementationPreview,
    appendUserNotice,
  ]);

  const { runImplementationStageAction } = useImplementationStageActionController({
    projectId,
    implementationControlPlaneSnapshot,
    boardSelectionBridge,
    codeTaskDispatchPreferredTaskIdRef,
    dbQueuedQuickRunDispatchRef,
    startImplementationQuickRun,
    recoverQuickRunStuckGithubVerify,
    handleManualGithubVerifyRetry,
    runIntegrationPipeline,
    openPreview: openPreviewFromStageAction,
    executeCodeTasks,
    appendUserNotice,
    legacyDispatch,
  });

  const { executeImplementationStageAction, runOrchestratedStageAction } =
    useImplementationStageActionOrchestrator({
      projectId,
      effectiveImplementationState,
      implementationStageBoardGateContext,
      currentWip: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      runImplementationStageAction,
      persistImplementationStageActionRun,
      persistStageActionTimelineEntries,
    });

  useEffect(() => {
    runImplementationStageActionRef.current = runImplementationStageAction;
    persistImplementationStageActionRunRef.current = persistImplementationStageActionRun;
  }, [runImplementationStageAction, persistImplementationStageActionRun]);

  const {
    handleRestartBoardTask,
    handleBoardSelectedTaskIdsChange,
    handleBoardSelectedCodeTaskIdsChange,
    handleImplementationBoardAction,
  } = useImplementationBoardInteractionController({
    projectId,
    implementationStageBoardGateContext,
    parsedRequirementsState,
    orchestrationAwareRequirementsState,
    orchestrationAwareRequirementsStateRef,
    executionSetupRow,
    boardSelectionBridge,
    boardManualPickTaskIdRef,
    runOrchestratedStageAction,
    runImplementationStageActionRef,
    executeImplementationStageAction,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatchRef,
    appendAiNoticeForImplementation,
  });

  const { handleImplementationChip, onPickImplementationInterviewLabel } =
    useImplementationChipHandlerController({
      projectId,
      parsedRequirementsState,
      effectiveImplementationState,
      prototypeRunSyncSnapshot,
      previewUrl,
      canRequestGenerationEnvOk: canRequestGeneration.envOk,
      implementationCursorGate,
      wipChipHandlers,
      executeImplementationStageAction,
      generateImplementationTaskList,
      generateImplementationWorkPlanDraft,
      confirmImplementationTaskPlan,
      reviewDbIntegrationNeed,
      generateDataModelDraft,
      confirmMockImplementationMode,
      appendImplementationTaskListAiMessage,
      appendUserNotice,
      appendAiNoticeForImplementation,
      setExecutionEnvironmentModalOpen,
      showImplementationSeedReadinessCheck,
      showRoleCheckDetails,
      appendStatusQueryFromChip,
      confirmExecution,
      onRefreshPrototypeStatus,
    });

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
    appendUserNotice,
  ]);

  const handleCopyCodeTaskCursorPrompt = useCallback(
    (codeTaskId: string) => {
      const pid = projectId.trim();
      const id = codeTaskId.trim();
      if (!pid || !id) return;
      void (async () => {
        const imp = await persistImplementationQuickRunRequirementsPrep({
          projectId: pid,
          requirementsState: orchestrationAwareRequirementsState,
          applyPendingFromOrchestrationPatch: (patch) => {
            applyPendingFromOrchestrationPatchRef.current(patch);
          },
          persistChatToDb,
        });
        const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
          gitRepoUrl: executionSetupRow?.gitRepoUrl,
          gitRepoName: executionSetupRow?.gitRepoName,
          gitRepoProvider: executionSetupRow?.gitRepoProvider,
          baseBranch: executionSetupRow?.baseBranch,
        });
        const runs = parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
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
        void writeClipboardText(result.prompt).then(() => {});
      })();
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
    void (async () => {
      const imp = await persistImplementationQuickRunRequirementsPrep({
        projectId: pid,
        requirementsState: orchestrationAwareRequirementsState,
        applyPendingFromOrchestrationPatch: (patch) => {
          applyPendingFromOrchestrationPatchRef.current(patch);
        },
        persistChatToDb,
      });
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
      const runs = parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
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
      void writeClipboardText(result.prompt).then(() => {});
    })();
  }, [
    projectId,
    orchestrationAwareRequirementsState,
    executionSetupRow,
    implementationRuntimeDbBundle?.job?.currentCodeTaskId,
    boardSelectionBridge,
    applyPendingFromOrchestrationPatchRef,
    persistChatToDb,
    appendUserNotice,
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
    implementationControlPlaneSnapshot,
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
