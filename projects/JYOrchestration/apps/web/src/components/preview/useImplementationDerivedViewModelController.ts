"use client";

import { useMemo } from "react";
import { useImplementationControlPlaneSnapshot } from "@/components/preview/useImplementationControlPlaneSnapshot";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import {
  resolveEffectiveImplementationState,
  resolveOrchestrationAwareRequirementsState,
} from "@/lib/prototype/effectiveImplementationState";
import {
  implementationEntryChipsForBootstrap,
  buildImplementationBootstrapShellView,
} from "@/lib/prototype/implementationOrchestrationSummary";
import { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { sanitizeIntegratedAppPreviewUrl } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import { prioritizeImplementationChipsForState } from "@/lib/prototype/implementationStageNextActions";
import {
  buildImplementationBootstrapInput,
  pickExecutionStateArtifacts,
} from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import { buildImplementationCursorGateContext } from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { resolvePersistedQueueDispatch } from "@/lib/prototype/implementationRuntimePanelBridge";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { PendingImplementationPatch } from "@/lib/prototype/effectiveImplementationState";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { toPrototypeChatEnvSnapshot } from "@/lib/prototype/prototypeExecutionEnvSnapshot";

/**
 * Builds implementation-stage derived view models.
 *
 * Scope:
 * - derive effective implementation state
 * - derive runtime queue snapshot
 * - derive prototype run sync snapshot
 * - derive control-plane snapshot
 * - derive board gate/input/view models
 * - derive implementation bootstrap shell and visible action labels
 * - derive implementation cursor gate
 * - derive execution artifacts and planning slot definitions
 *
 * Not scope:
 * - controller side effects
 * - persistence
 * - CodeTask execution
 * - GitHub verification
 */
export type ImplementationDerivedViewModelControllerInput = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly pendingImplementationPatch: PendingImplementationPatch;
  readonly orchestrationAwareRequirementsState: ReturnType<
    typeof resolveOrchestrationAwareRequirementsState
  >;
  readonly canRequestGeneration: Readonly<{ envOk: boolean; designOk: boolean }>;
  readonly latestRun: PrototypeRun | null;
  readonly protoBusy: boolean;
  readonly isPlannerRunning: boolean;
  readonly plannerCreatePending: boolean;
  readonly executionEnvLoading: boolean;
  readonly executionEnvSnapshot: ReturnType<typeof toPrototypeChatEnvSnapshot>;
  readonly envSettingsHref: string;
  readonly featureDraftTitles?: readonly string[];
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly implementationRuntimePollSuspendedRef: Readonly<{ readonly current: boolean }>;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly canApplyGit: boolean | undefined;
  readonly activeTaskCursorJob: TaskCursorJobSummary | null;
}>;

export type ImplementationDerivedViewModelControllerValue = Readonly<{
  readonly effectiveImplementationState: ReturnType<typeof resolveEffectiveImplementationState>;
  readonly effectiveCodeTaskExecutionQueueV1: ReturnType<
    typeof resolveEffectiveCodeTaskExecutionQueue
  > | null;
  readonly persistedQueueDispatch: ReturnType<typeof resolvePersistedQueueDispatch>;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly implementationControlPlaneSnapshot: ReturnType<typeof useImplementationControlPlaneSnapshot>;
  readonly implementationStageBoardGateContext: ReturnType<
    typeof buildImplementationStageBoardGateContext
  > | null;
  readonly implementationStageBoardInput: {
    readonly projectId: string;
    readonly taskList: NonNullable<RequirementsStateJson["implementationTaskListV1"]>;
    readonly executionState: RequirementsStateJson["implementationTaskExecutionStateV1"];
    readonly integratedExecutionState: RequirementsStateJson["implementationIntegratedExecutionStateV1"];
    readonly boardState: RequirementsStateJson["implementationExecutionBoardStateV1"];
    readonly qualityGateResults: RequirementsStateJson["implementationQualityGateResultsV1"];
    readonly previewReady: boolean;
    readonly codeAgentWipExecutionV1: RequirementsStateJson["codeAgentWipExecutionV1"];
    readonly taskCursorExecutionV1: RequirementsStateJson["taskCursorExecutionV1"];
    readonly implementationAutoQualityGateV1: RequirementsStateJson["implementationAutoQualityGateV1"];
    readonly implementationCodeTaskPlanV1: RequirementsStateJson["implementationCodeTaskPlanV1"];
    readonly codeTaskExecutionRunsV1: RequirementsStateJson["codeTaskExecutionRunsV1"];
    readonly taskCursorExecutionHistoryV1: RequirementsStateJson["taskCursorExecutionHistoryV1"];
    readonly canApplyGit: boolean | undefined;
  } | null;
  readonly implementationBoard: NonNullable<
    ReturnType<typeof buildImplementationStageBoardGateContext>
  >["board"] | null;
  readonly executionArtifacts: ReturnType<typeof pickExecutionStateArtifacts>;
  readonly planningSlotDefinitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly implementationBootstrapInput: ReturnType<typeof buildImplementationBootstrapInput>;
  readonly implementationBootstrapShell: ReturnType<typeof buildImplementationBootstrapShellView> | null;
  readonly implementationCursorGate: ReturnType<typeof buildImplementationCursorGateContext>;
}>;

export function useImplementationDerivedViewModelController(
  input: ImplementationDerivedViewModelControllerInput,
): ImplementationDerivedViewModelControllerValue {
  const effectiveCodeTaskExecutionQueueV1 = useMemo(
    () =>
      resolveEffectiveCodeTaskExecutionQueue({
        dbBundle: input.implementationRuntimeDbBundle,
      }),
    [input.implementationRuntimeDbBundle],
  );

  const persistedQueueDispatch = useMemo(
    () => resolvePersistedQueueDispatch(input.orchestrationAwareRequirementsState),
    [input.orchestrationAwareRequirementsState.implementationRuntimeUiSnapshotV1],
  );

  const prototypeRunSyncSnapshot = useMemo(
    () =>
      deriveImplementationPrototypeRunSyncSnapshot({
        latestRun: input.latestRun,
        workUnits: input.latestRun?.workUnits,
      }),
    [input.latestRun],
  );

  const integratedAppPreviewReady = useMemo(
    () =>
      resolveIntegratedAppPreviewReadyFromOrchestration({
        projectId: input.projectId,
        orchestration: input.orchestrationAwareRequirementsState,
      }),
    [input.projectId, input.orchestrationAwareRequirementsState],
  );

  const orchestrationPreviewUrl = useMemo(() => {
    const pid = input.projectId.trim();
    if (!pid) return null;
    const runtime = parseImplementationPreviewRuntimeV1(
      input.orchestrationAwareRequirementsState.implementationPreviewRuntimeV1,
    );
    return (
      sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: runtime?.internalAppPreviewUrl }) ??
      sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: runtime?.previewUrl }) ??
      sanitizeIntegratedAppPreviewUrl({ projectId: pid, url: runtime?.externalPreviewUrl }) ??
      null
    );
  }, [input.projectId, input.orchestrationAwareRequirementsState.implementationPreviewRuntimeV1]);

  const implementationControlPlaneSnapshot = useImplementationControlPlaneSnapshot({
    projectId: input.projectId,
    selectionSummary: input.boardSelectionBridge.liveCodeTaskSelectionSummary,
    previewReady: prototypeRunSyncSnapshot.previewReady || integratedAppPreviewReady,
    integratedAppPreviewReady,
    actualPreviewUrl: orchestrationPreviewUrl ?? prototypeRunSyncSnapshot.previewUrl ?? null,
    runtime: {
      hasDbRuntimeJob: Boolean(input.implementationRuntimeDbBundle?.job),
      currentCodeTaskId: input.implementationRuntimeDbBundle?.job?.currentCodeTaskId?.trim() ?? null,
      currentRuntimeState: input.implementationRuntimeDbBundle?.job?.state?.trim() ?? null,
      shouldPoll: !input.implementationRuntimePollSuspendedRef.current,
    },
  });

  const implementationStageBoardGateContext = useMemo(() => {
    const pid = input.projectId.trim();
    const taskList = input.orchestrationAwareRequirementsState.implementationTaskListV1;
    if (!pid || !taskList) return null;
    return buildImplementationStageBoardGateContext({
      projectId: pid,
      taskList,
      executionState: input.orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      integratedExecutionState:
        input.orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
      boardState: input.orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
      qualityGateResults: input.orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
      previewReady: prototypeRunSyncSnapshot.previewReady,
      codeAgentWipExecutionV1: input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      taskCursorExecutionV1: input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
      canApplyGit: input.canApplyGit,
      implementationCodeTaskPlanV1:
        input.orchestrationAwareRequirementsState.implementationCodeTaskPlanV1,
      cursorWorkItemsV1: input.orchestrationAwareRequirementsState.cursorWorkItemsV1,
      implementationWorkItemPreflightSummaryV1:
        input.orchestrationAwareRequirementsState.implementationWorkItemPreflightSummaryV1,
      implementationCodeTaskQualityGateV1:
        input.orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
      codeTaskExecutionRunsV1: input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1 ?? null,
      taskCursorExecutionHistoryV1:
        input.orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      implementationAutoQualityGateV1:
        input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1 ?? null,
      activeTaskCursorJob: input.activeTaskCursorJob,
      implementationExecutionJobsV1:
        input.orchestrationAwareRequirementsState.implementationExecutionJobsV1 ?? null,
    });
  }, [
    input.activeTaskCursorJob,
    input.canApplyGit,
    input.orchestrationAwareRequirementsState,
    input.projectId,
    prototypeRunSyncSnapshot.previewReady,
  ]);

  const effectiveImplementationState = useMemo(
    () =>
      resolveEffectiveImplementationState({
        parsedRequirementsState: input.parsedRequirementsState,
        pendingPatch: input.pendingImplementationPatch,
        envOk: input.canRequestGeneration.envOk,
        designOk: input.canRequestGeneration.designOk,
        latestRun: input.latestRun,
        plannerRunning: input.isPlannerRunning,
        plannerCreatePending: input.plannerCreatePending,
        protoBusy: input.protoBusy,
      }),
    [
      input.canRequestGeneration.designOk,
      input.canRequestGeneration.envOk,
      input.isPlannerRunning,
      input.latestRun,
      input.parsedRequirementsState,
      input.pendingImplementationPatch,
      input.plannerCreatePending,
      input.protoBusy,
    ],
  );

  const executionArtifacts = useMemo(
    () => pickExecutionStateArtifacts(input.parsedRequirementsState),
    [input.parsedRequirementsState],
  );

  const planningSlotDefinitions = useMemo(
    () =>
      buildDynamicServicePlanningSlotDefinitions({
        projectName: input.projectName.trim() || "프로젝트",
        projectDescription: input.projectDescription ?? "",
      }),
    [input.projectDescription, input.projectName],
  );

  const implementationBootstrapInput = useMemo(
    () =>
      buildImplementationBootstrapInput({
        envLoading: input.executionEnvLoading,
        projectId: input.projectId,
        env: input.executionEnvSnapshot,
        envOk: input.canRequestGeneration.envOk,
        envSettingsHref: input.envSettingsHref,
        featureDraftTitles: input.featureDraftTitles ?? [],
        projectArtifacts: executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
        designOk: input.canRequestGeneration.designOk,
        orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
        slotDefinitions: planningSlotDefinitions,
        implementationSeedV1: input.orchestrationAwareRequirementsState.implementationSeedV1,
        implementationTaskListV1: input.orchestrationAwareRequirementsState.implementationTaskListV1,
        implementationTaskPlanV1: input.orchestrationAwareRequirementsState.implementationTaskPlanV1,
        cursorWorkItemsV1: input.orchestrationAwareRequirementsState.cursorWorkItemsV1,
        fastPlanDraftV1: input.parsedRequirementsState.fastPlanDraftV1,
        promptTimeline: input.orchestrationAwareRequirementsState.promptTimeline,
        executionSetup: input.executionSetupRow,
      }),
    [
      executionArtifacts,
      input.canRequestGeneration.designOk,
      input.canRequestGeneration.envOk,
      input.envSettingsHref,
      input.executionEnvLoading,
      input.executionEnvSnapshot,
      input.executionSetupRow,
      input.featureDraftTitles,
      input.orchestrationAwareRequirementsState.cursorWorkItemsV1,
      input.orchestrationAwareRequirementsState.implementationSeedV1,
      input.orchestrationAwareRequirementsState.implementationTaskListV1,
      input.orchestrationAwareRequirementsState.implementationTaskPlanV1,
      input.orchestrationAwareRequirementsState.promptTimeline,
      input.parsedRequirementsState.fastPlanDraftV1,
      input.parsedRequirementsState.singleChatOrchestrationV1,
      input.projectId,
      planningSlotDefinitions,
    ],
  );

  const implementationStageBoardInput = useMemo(() => {
    const pid = input.projectId.trim();
    const taskList = input.orchestrationAwareRequirementsState.implementationTaskListV1;
    if (!pid || !taskList) return null;
    return {
      projectId: pid,
      taskList,
      executionState: input.orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      integratedExecutionState:
        input.orchestrationAwareRequirementsState.implementationIntegratedExecutionStateV1,
      boardState: input.orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
      qualityGateResults: input.orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
      previewReady: prototypeRunSyncSnapshot.previewReady,
      codeAgentWipExecutionV1: input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
      taskCursorExecutionV1: input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
      implementationAutoQualityGateV1:
        input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1,
      implementationCodeTaskPlanV1: input.orchestrationAwareRequirementsState.implementationCodeTaskPlanV1,
      codeTaskExecutionRunsV1: input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1 ?? null,
      taskCursorExecutionHistoryV1:
        input.orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1 ?? null,
      canApplyGit: input.canApplyGit,
    };
  }, [
    input.canApplyGit,
    input.orchestrationAwareRequirementsState,
    input.projectId,
    prototypeRunSyncSnapshot.previewReady,
  ]);

  const implementationBoard = implementationStageBoardGateContext?.board ?? null;

  const implementationVisibleActionLabels = useMemo(() => {
    const labels = implementationBootstrapInput
      ? implementationEntryChipsForBootstrap(implementationBootstrapInput)
      : [];
    return prioritizeImplementationChipsForState(
      labels,
      effectiveImplementationState,
      input.orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
      implementationStageBoardInput,
    );
  }, [
    effectiveImplementationState,
    implementationBootstrapInput,
    implementationStageBoardInput,
    input.orchestrationAwareRequirementsState.implementationTaskExecutionStateV1,
  ]);

  const implementationBootstrapShell = useMemo(() => {
    if (implementationBoard) return null;
    return buildImplementationBootstrapShellView({
      summaryInput: implementationBootstrapInput,
      actionLabels: implementationVisibleActionLabels,
    });
  }, [implementationBoard, implementationBootstrapInput, implementationVisibleActionLabels]);

  const implementationCursorGate = useMemo(
    () =>
      buildImplementationCursorGateContext(
        {
          ...input.parsedRequirementsState,
          implementationTaskPlanV1: effectiveImplementationState.implementationTaskPlanV1,
        },
        {
          envOk: effectiveImplementationState.envOk,
          designOk: effectiveImplementationState.designOk,
        },
        { projectId: input.projectId.trim() || undefined },
      ),
    [effectiveImplementationState, input.parsedRequirementsState, input.projectId],
  );

  return {
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
  };
}
