"use client";

/**
 * Implementation stage parent hook is intentionally kept as a controller-composition shell.
 *
 * Heavyweight business logic must live in named useImplementation*Controller hooks.
 * When adding implementation-stage behavior, prefer adding or extending a controller
 * and update implementationParentHookComplexityGuard.unit.test.ts accordingly.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PrototypeChatAction } from "@/lib/prototype/buildPrototypeChatMessages";
import { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import { resolveCheckedCodeTaskIdsFromBoardBridge } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import {
  useImplementationIntegrationPipelineController,
  type ImplementationIntegrationPipelineClientResultV1,
} from "@/components/preview/useImplementationIntegrationPipelineController";
import { useImplementationGithubVerifyController } from "@/components/preview/useImplementationGithubVerifyController";
import { useImplementationQuickRunController } from "@/components/preview/useImplementationQuickRunController";
import { useImplementationStageActionAdapterController } from "@/components/preview/useImplementationStageActionAdapterController";
import { useImplementationWipChipHandlerController } from "@/components/preview/useImplementationWipChipHandlerController";
import { useImplementationBoardInteractionController } from "@/components/preview/useImplementationBoardInteractionController";
import { useImplementationChipHandlerController } from "@/components/preview/useImplementationChipHandlerController";
import { useImplementationPreviewController } from "@/components/preview/useImplementationPreviewController";
import { useImplementationFinalScmController } from "@/components/preview/useImplementationFinalScmController";
import { useImplementationQualityIntegratedStageController } from "@/components/preview/useImplementationQualityIntegratedStageController";
import { useImplementationDeveloperPromptCopyController } from "@/components/preview/useImplementationDeveloperPromptCopyController";
import { useImplementationExecutionLogController } from "@/components/preview/useImplementationExecutionLogController";
import { useImplementationAutoPrepSyncController } from "@/components/preview/useImplementationAutoPrepSyncController";
import { useImplementationStatusNoticeController } from "@/components/preview/useImplementationStatusNoticeController";
import { useImplementationPlanningActionController } from "@/components/preview/useImplementationPlanningActionController";
import { useImplementationDbStrategyActionController } from "@/components/preview/useImplementationDbStrategyActionController";
import { useImplementationBoardRefreshController } from "@/components/preview/useImplementationBoardRefreshController";
import { useImplementationToolbarController } from "@/components/preview/useImplementationToolbarController";
import { useImplementationSingleChatWorkspaceController } from "@/components/preview/useImplementationSingleChatWorkspaceController";
import { useImplementationSessionResetController } from "@/components/preview/useImplementationSessionResetController";
import { useImplementationRuntimeRecoveryController } from "@/components/preview/useImplementationRuntimeRecoveryController";
import { useImplementationDeliverableViewerController } from "@/components/preview/useImplementationDeliverableViewerController";
import { useImplementationRuntimeSyncController } from "@/components/preview/useImplementationRuntimeSyncController";
import {
  useImplementationDerivedViewModelController,
  type ImplementationDerivedViewModelControllerValue,
} from "@/components/preview/useImplementationDerivedViewModelController";
import { useImplementationNoticeModalController } from "@/components/preview/useImplementationNoticeModalController";
import { useImplementationEntryRecoveryController } from "@/components/preview/useImplementationEntryRecoveryController";
import { useApplyImplementationOrchestrationResult } from "@/components/preview/useApplyImplementationOrchestrationResult";
import { usePrototypeExecutionPersistChatToDb } from "@/components/preview/usePrototypeExecutionPersistChatToDb";
import { useImplementationStageActionTimeline } from "@/components/preview/useImplementationStageActionTimeline";
import { useProjectRecommendationEvidence } from "@/lib/recommendation/useProjectRecommendationEvidence";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import { toPrototypeChatEnvSnapshot } from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  mergePendingImplementationPatch,
  mergePendingImplementationPatchFromOrchestration,
  resolveOrchestrationAwareRequirementsState,
  shouldClearPendingImplementationPatch,
  type ImplementationStageActionId,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { hasActiveImplementationExecutionSession } from "@/lib/requirements/resetDerivedImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  pickPersistentExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { readActiveRuntimeDispatchFromState } from "@/lib/prototype/implementationRuntimeSync";
import {
  postImplementationRuntimeAction,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { computePrototypeExecutionSlots } from "@/lib/prototype/prototypeExecutionSlots";
import {
  PROTOTYPE_TEMPLATES,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

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
  implementationBoard: ImplementationDerivedViewModelControllerValue["implementationBoard"];
  implementationStageBoardInput: ImplementationDerivedViewModelControllerValue["implementationStageBoardInput"];
  prototypeRunSyncSnapshot: ImplementationDerivedViewModelControllerValue["prototypeRunSyncSnapshot"];
  effectiveCodeTaskExecutionQueueV1: ImplementationDerivedViewModelControllerValue["effectiveCodeTaskExecutionQueueV1"];
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
  implementationControlPlaneSnapshot: ImplementationDerivedViewModelControllerValue["implementationControlPlaneSnapshot"];
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
  implementationBootstrapShell: ImplementationDerivedViewModelControllerValue["implementationBootstrapShell"];
  implementationNoticeSuccessToast: string | null;
  implementationNoticeErrorToast: string | null;
  implementationExecutionLogModalOpen: boolean;
  setImplementationExecutionLogModalOpen: (open: boolean) => void;
  onClearImplementationExecutionLog: () => void;
  latestRunForDevTools: PrototypeRun | null;
  executionSlotsForDevTools: ReturnType<typeof computePrototypeExecutionSlots>;
  implementationDeveloperDashboardOpen: boolean;
  setImplementationDeveloperDashboardOpen: (open: boolean) => void;
  implementationSingleChatWorkspace: ReturnType<typeof useImplementationSingleChatWorkspaceController>;
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

  const [pendingImplementationPatch, setPendingImplementationPatch] =
    useState<PendingImplementationPatch>({});
  const pendingImplementationPatchRef = hostPendingImplementationPatchRef;
  pendingImplementationPatchRef.current = pendingImplementationPatch;

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
  const runImplementationStageActionRef = useRef<
    (
      actionId: ImplementationStageActionId,
    ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >(() => ({ outcome: "blocked", message: "구현단계 action을 준비하는 중입니다." }));
  const persistImplementationStageActionRunRef = useRef<(run: ImplementationStageActionRun) => void>(() => {});
  const applyImplementationOrchestrationResultRef = useRef<
    (input: {
      readonly messages?: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
      readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
    }) => void
  >(() => {});
  const appendImplementationExecutionNoticeRef = useRef<(content: string) => void>(() => {});
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
  const [implementationDeveloperDashboardOpen, setImplementationDeveloperDashboardOpen] = useState(false);
  const activeTaskCursorJobRef = useRef<TaskCursorJobSummary | null>(null);
  activeTaskCursorJobRef.current = activeTaskCursorJob;
  const boardManualPickTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    const incoming = parseRequirementsStateJson(requirementsStateJson);
    const current = parseRequirementsStateJson(requirementsStateJsonRef.current);
    const incomingSessionActive = hasActiveImplementationExecutionSession(incoming);
    const currentSessionActive = hasActiveImplementationExecutionSession(current);
    const incomingLogCount = pickPersistentExecutionLogTimelineEntries(incoming.promptTimeline).length;
    const currentLogCount = pickPersistentExecutionLogTimelineEntries(current.promptTimeline).length;
    const incomingTimelineLen = (incoming.promptTimeline ?? []).length;
    const currentTimelineLen = (current.promptTimeline ?? []).length;
    if (
      (currentSessionActive && !incomingSessionActive) ||
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
    dispatchNextQuickRunFromGithubVerify,
  } = useImplementationRuntimeSyncController({
    projectId,
    orchestrationAwareRequirementsState,
    requirementsStateJsonRef,
    implementationResetInFlightRef,
    setActiveTaskCursorJob,
    dbQueuedQuickRunDispatchRef,
    pendingQuickRunQueueDispatchRef,
    codeTaskDispatchPreferredTaskIdRef,
    runImplementationStageActionRef,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationOrchestrationResultRef,
    appendImplementationExecutionNoticeRef,
  });

  const {
    effectiveImplementationState,
    effectiveCodeTaskExecutionQueueV1,
    persistedQueueDispatch,
    prototypeRunSyncSnapshot,
    implementationControlPlaneSnapshot,
    implementationStageBoardGateContext,
    implementationStageBoardInput,
    implementationBoard,
    executionArtifacts,
    planningSlotDefinitions,
    implementationBootstrapInput,
    implementationBootstrapShell,
    implementationCursorGate,
  } = useImplementationDerivedViewModelController({
    projectId,
    projectName,
    projectDescription,
    parsedRequirementsState,
    pendingImplementationPatch,
    orchestrationAwareRequirementsState,
    canRequestGeneration,
    latestRun,
    protoBusy,
    isPlannerRunning,
    plannerCreatePending,
    executionEnvLoading,
    executionEnvSnapshot,
    envSettingsHref,
    featureDraftTitles,
    executionSetupRow,
    implementationRuntimeDbBundle,
    implementationRuntimePollSuspendedRef,
    boardSelectionBridge,
    canApplyGit,
    activeTaskCursorJob,
  });

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

  useImplementationEntryRecoveryController({
    projectId,
    requirementsStateJson,
    parsedRequirementsState,
    persistChatToDb,
  });

  const {
    implementationNoticeSuccessToast,
    implementationNoticeErrorToast,
    appendAiNoticeForImplementation,
    appendUserNotice,
    appendImplementationExecutionNotice,
    showIntegrationPipelineUserNotice,
  } = useImplementationNoticeModalController({
    projectId,
    orchestrationAwareRequirementsStateRef,
    integrationPipelineClientResultRef,
    appendImplementationExecutionNoticeRef,
  });

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

  const applyImplementationOrchestrationResult = useApplyImplementationOrchestrationResult({
    projectId,
    requirementsStateJson,
    requirementsStateJsonRef,
    orchestrationPersistSeqRef,
    persistChatToDb,
    applyPendingFromOrchestrationPatch,
    onRequirementsStateJsonChange,
  });

  useEffect(() => {
    applyImplementationOrchestrationResultRef.current = applyImplementationOrchestrationResult;
  }, [applyImplementationOrchestrationResult]);

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

  const { handleRetryFailedCodeTask } = useImplementationRuntimeRecoveryController({
    projectId,
    orchestrationAwareRequirementsState,
    effectiveCodeTaskExecutionQueueV1,
    quickRunStuckGithubVerifyRef,
    recoverQuickRunStuckGithubVerify,
    loadImplementationRuntimeDb,
    applyGithubPollingOrchestrationPatch: (patch) => {
      applyImplementationOrchestrationResult({
        orchestrationPatch: patch as import("@/lib/prototype/prototypeExecutionTaskPlanPersist").PrototypeExecutionOrchestrationPersistInput,
      });
    },
  });

  const {
    appendImplementationTaskListAiMessage,
    appendStatusQueryFromChip,
    showRoleCheckDetails,
    showImplementationSeedReadinessCheck,
  } = useImplementationStatusNoticeController({
    projectId,
    requirementsStateJson,
    requirementsStateJsonRef,
    parsedRequirementsState,
    orchestrationAwareRequirementsStateRef,
    implementationBootstrapInput,
    planningSlotDefinitions,
    applyImplementationOrchestrationResult,
    persistChatToDb,
    appendAiNoticeForImplementation,
  });

  const {
    createImplementationSeedFromQuickDesignDraft,
    confirmQuickDesignForImplementation,
    generateImplementationTaskList,
    generateImplementationWorkPlanDraft,
    confirmImplementationTaskPlan,
  } = useImplementationPlanningActionController({
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    parsedRequirementsState,
    effectiveImplementationState,
    executionArtifacts,
    featureDraftTitles,
    planningSlotDefinitions,
    envOk: canRequestGeneration.envOk,
    designOk: effectiveImplementationState.designOk,
    prototypeRunSyncSnapshot,
    setProtoBusy,
    applyImplementationOrchestrationResult,
    persistChatToDb,
    appendImplementationTaskListAiMessage,
    appendUserNotice,
  });

  const {
    reviewDbIntegrationNeed,
    generateDataModelDraft,
    confirmMockImplementationMode,
  } = useImplementationDbStrategyActionController({
    projectId,
    requirementsStateJson,
    parsedRequirementsState,
    effectiveImplementationState,
    executionArtifacts,
    planningSlotDefinitions,
    canRequestGenerationEnvOk: canRequestGeneration.envOk,
    applyImplementationOrchestrationResult,
    appendUserNotice,
  });

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

  useImplementationAutoPrepSyncController({
    autoRefineImplementationPrep,
    projectId,
    parsedRequirementsState,
    orchestrationAwareRequirementsState,
    requirementsStateJson,
    executionArtifacts,
    envOk: canRequestGeneration.envOk,
    designOk: effectiveImplementationState.designOk,
    prototypeRunSyncSnapshot,
    persistChatToDb,
    appendImplementationTaskListAiMessage,
  });

  const { handleExecutionSetupChanged } = useImplementationBoardRefreshController({
    projectId,
    orchestrationAwareRequirementsState,
    executionSetupRow,
    executionSetupBoardSyncedKeyRef,
    refreshImplementationBoardRef,
    refreshExecutionEnvironmentStatus,
  });

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

  const { runImplementationQualityGate, runIntegratedStageStep } =
    useImplementationQualityIntegratedStageController({
      projectId,
      parsedRequirementsState,
      orchestrationAwareRequirementsState,
      executionSetupRow,
      prototypeRunSyncSnapshot,
      runFinalScmIntegratedStageStep,
      persistChatToDb,
      appendAiNoticeForImplementation,
      appendImplementationTaskListAiMessage,
    });

  const { handleCopyCodeTaskCursorPrompt, handleCopyDeveloperPromptsFromHeader } =
    useImplementationDeveloperPromptCopyController({
      projectId,
      orchestrationAwareRequirementsState,
      executionSetupRow,
      implementationRuntimeDbBundle,
      boardSelectionBridge,
      applyPendingFromOrchestrationPatchRef,
      persistChatToDb,
    });

  const {
    implementationExecutionLogModalOpen,
    setImplementationExecutionLogModalOpen,
    onOpenImplementationExecutionLog,
    onClearImplementationExecutionLog,
  } = useImplementationExecutionLogController({
    orchestrationAwareRequirementsStateRef,
    applyPendingFromOrchestrationPatchRef,
    persistChatToDb,
  });

  const onResetImplementationLocalCaches = useCallback(() => {
    setPendingImplementationPatch({} as PendingImplementationPatch);
    pendingImplementationPatchRef.current = {};
    setImplementationRuntimeDbBundle(null);
    setActiveTaskCursorJob(null);
    lastServerTaskCursorJobSyncFingerprintRef.current = "";
    implementationSessionActiveRef.current = false;
    persistedDraftUpdatedAtRef.current = null;
    persistedTaskPlanCreatedAtRef.current = null;
  }, []);

  const {
    onResetImplementationSession,
    resetImplementationSessionBusy,
    resetImplementationSessionDisabled,
  } = useImplementationSessionResetController({
    projectId,
    projectName,
    projectDescription,
    slotDefinitions: planningSlotDefinitions,
    envOk: effectiveImplementationState.envOk,
    designOk: effectiveImplementationState.designOk,
    userSelectedTemplateId: effectiveTemplate,
    parsedRequirementsState,
    requirementsStateJsonRef,
    orchestrationPersistSeqRef,
    implementationResetInFlightRef,
    onRequirementsStateJsonChange,
    onResetLocalCaches: onResetImplementationLocalCaches,
    appendUserNotice,
    protoBusy,
  });

  const { wipChipHandlers } = useImplementationWipChipHandlerController({
    projectId,
    requirementsStateJson,
    parsedRequirementsState,
    pendingImplementationPatch,
    orchestrationAwareRequirementsState,
    effectiveImplementationState,
    executionSetupRow,
    executePlatformScmAfterRequest,
    canApplyGit,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatch,
    persistChatToDb,
    appendAiNoticeForImplementation,
    appendUserNotice,
  });

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

  const { executeImplementationStageAction, runOrchestratedStageAction } =
    useImplementationStageActionAdapterController({
      legacyDispatchInput: {
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
      },
      implementationControlPlaneSnapshot,
      boardSelectionBridge,
      codeTaskDispatchPreferredTaskIdRef,
      dbQueuedQuickRunDispatchRef,
      startImplementationQuickRun,
      recoverQuickRunStuckGithubVerify,
      handleManualGithubVerifyRetry,
      runIntegrationPipeline,
      openImplementationPreview,
      previewUrl,
      appendUserNotice,
      effectiveImplementationState,
      implementationStageBoardGateContext,
      currentWip: orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      persistImplementationStageActionRun,
      persistStageActionTimelineEntries,
      runImplementationStageActionRef,
      persistImplementationStageActionRunRef,
    });

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

  const implementationSingleChatWorkspace = useImplementationSingleChatWorkspaceController({
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    requirementsStateJsonRef,
    parsedRequirementsState,
    protoBusy,
    setProtoBusy,
    latestRun,
    setLatestRun,
    canRequestGeneration,
    effectiveImplementationState,
    implementationBootstrapInput,
    implementationStageBoardInput,
    planningSlotDefinitions,
    projectArtifacts: planningOrchestrationView.projectArtifacts,
    isDraftGenerationComplete,
    isRunningState,
    templatePlanningReady,
    isPlannerRunning,
    plannerCreatePending,
    plannerContextPayload,
    effectiveTemplate,
    effectiveTemplateDefName: effectiveTemplateDef?.nameKo ?? effectiveTemplate,
    ideationSummaryForChat,
    actorFlowSummaryForChat,
    executionEnvLoading,
    startWorkPlanGenerationFromChat,
    setPlannerPromptModalOpen,
    setExecutionEnvironmentModalOpen,
    handleChatIntent,
    handleImplementationChip,
    appendUserNotice,
    applyPendingFromOrchestrationPatch,
    applyImplementationOrchestrationResult,
    persistImplementationStageActionRun,
    runImplementationStageActionRef,
  });

  const onExecuteSelectedCodeTasksFromToolbar = useCallback(() => {
    const cp = implementationControlPlaneSnapshot;
    if (
      cp?.action.primaryAction === "execute_selected_runnable_codetasks" &&
      cp.action.enabled &&
      cp.action.codeTaskIds.length > 0
    ) {
      void startImplementationQuickRun({ selectedCodeTaskIds: cp.action.codeTaskIds });
      return;
    }
    const selected = resolveCheckedCodeTaskIdsFromBoardBridge({
      bridge: boardSelectionBridge.getBridgeSnapshot(),
      requirementsState: orchestrationAwareRequirementsState,
    });
    void startImplementationQuickRun({ selectedCodeTaskIds: selected });
  }, [
    boardSelectionBridge,
    implementationControlPlaneSnapshot,
    orchestrationAwareRequirementsState,
    startImplementationQuickRun,
  ]);

  const executeSelectedCodeTasksToolbarDisabled = useMemo(() => {
    if (protoBusy || resetImplementationSessionBusy) return true;
    return (implementationControlPlaneSnapshot?.board.selectionSummary.selectedRunnableCount ?? 0) <= 0;
  }, [implementationControlPlaneSnapshot, protoBusy, resetImplementationSessionBusy]);

  const executeSelectedCodeTasksToolbarEmphasized = useMemo(
    () => (implementationControlPlaneSnapshot?.board.selectionSummary.selectedCount ?? 0) >= 1,
    [implementationControlPlaneSnapshot],
  );

  const { executionConversationIconToolbar } = useImplementationToolbarController({
    setExecutionEnvironmentModalOpen,
    onOpenDeveloperDashboard: () => setImplementationDeveloperDashboardOpen(true),
    developerDashboardDisabled: !implementationBoard && !implementationBootstrapShell,
    onOpenImplementationExecutionLog,
    onResetImplementationSession,
    resetImplementationSessionDisabled,
    onExecuteSelectedCodeTasks: onExecuteSelectedCodeTasksFromToolbar,
    executeSelectedCodeTasksDisabled: executeSelectedCodeTasksToolbarDisabled,
    executeSelectedCodeTasksEmphasized: executeSelectedCodeTasksToolbarEmphasized,
  });

  const { deliverableViewer } = useImplementationDeliverableViewerController();

  const recommendationEvidence = useProjectRecommendationEvidence({
    projectId,
    requirementsStateJson: parsedRequirementsState,
    projectArtifacts: planningOrchestrationView.projectArtifacts,
    projectDescription,
  });

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
    implementationNoticeSuccessToast,
    implementationNoticeErrorToast,
    implementationExecutionLogModalOpen,
    setImplementationExecutionLogModalOpen,
    onClearImplementationExecutionLog,
    handleExecutionSetupChanged,
    latestRunForDevTools: latestRun,
    executionSlotsForDevTools: executionSlots,
    implementationDeveloperDashboardOpen,
    setImplementationDeveloperDashboardOpen,
    implementationSingleChatWorkspace,
  };
}
