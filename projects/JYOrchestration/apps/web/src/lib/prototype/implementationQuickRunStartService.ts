import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import {
  listCodeTaskPromptContextIdsToRefresh,
  repairSampleDataCodeTaskFileBoundariesInPlan,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import {
  augmentProductionCodeTaskIdRemap,
  remapCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskCanonicalId";
import {
  buildCodeTaskIdRemapFromPlanTasks,
  mergeCursorWorkItemsWithMissingCodeTaskPlanTasks,
  reconcileCursorWorkItemsWithCodeTaskIdRemap,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  parseCodeTaskPromptContextMapV1,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  parseCodeTaskExecutionRunsV1,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { getCodeTaskPromptContextFromMap } from "@/lib/prototype/codeTaskPromptContext";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import type { ImplementationBoardSelectionBridgeSnapshotV1 } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import { resolveSelectedRunnableCodeTaskIdsForQuickRun } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import { buildImplementationQuickRunStartedPatch } from "@/lib/prototype/implementationQuickRun";
import {
  prepareSelectedCodeTaskIdsForQuickRun,
  QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { buildPersistedActiveDispatchSnapshotPatch } from "@/lib/prototype/implementationRuntimePanelBridge";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import {
  postImplementationRuntimeAction,
  type ImplementationRuntimeFetchResult,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import { postDbQueuedQuickRunAutoDispatch } from "@/lib/prototype/implementationDbQueuedQuickRunContinuation";
import {
  buildImplementationQuickRunCursorDispatchTimelineEntry,
  buildImplementationQuickRunTimelineEntry,
  formatQuickRunContinuationReason,
} from "@/lib/prototype/implementationQuickRun";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  buildImplementationDatabaseRequiredBlockedTimelineEntry,
  evaluateImplementationDatabaseRequiredExecutionBlock,
  IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
} from "@/lib/prototype/implementationPlanningDatabaseExecutionGuard";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";
export type QuickRunPrepRepairV1 = Readonly<{
  readonly fromCodeTaskId: string;
  readonly toCodeTaskId: string;
}>;

export type EvaluateQuickRunPrepAndSelectionResultV1 =
  | Readonly<{
      readonly ok: false;
      readonly kind: "database_required";
      readonly blockReason: typeof IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON;
      readonly message: string;
      readonly actionLabel: typeof PLANNING_DATABASE_SETUP_LABEL;
      readonly timelineEntry: ReturnType<typeof buildImplementationDatabaseRequiredBlockedTimelineEntry>;
    }>
  | Readonly<{
      readonly ok: false;
      readonly kind: "mock_id_blocked";
      readonly message: string;
      readonly codeTaskId: string;
      readonly timelineEntry: ReturnType<typeof buildImplementationExecutionLogTimelineEntry>;
    }>
  | Readonly<{
      readonly ok: false;
      readonly kind: "no_runnable_selection";
      readonly message: string;
      readonly phase: "blocked_no_runnable_selection" | "toolbar_blocked_no_selection";
      readonly selectedCount: number;
    }>
  | Readonly<{
      readonly ok: true;
      readonly selectedRunnableCodeTaskIds: readonly string[];
      readonly repairs: readonly QuickRunPrepRepairV1[];
    }>;

export function evaluateImplementationQuickRunPrepAndSelection(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
  readonly bridge: ImplementationBoardSelectionBridgeSnapshotV1;
}): EvaluateQuickRunPrepAndSelectionResultV1 {
  const pid = input.projectId.trim();
  const imp = input.requirementsState;
  const nowIso = new Date().toISOString();
  const databaseBlock = evaluateImplementationDatabaseRequiredExecutionBlock({
    planningHandoffForImplementationV1: imp.planningHandoffForImplementationV1 ?? null,
  });
  if (databaseBlock.blocked) {
    return {
      ok: false,
      kind: "database_required",
      blockReason: databaseBlock.blockReason,
      message: databaseBlock.message,
      actionLabel: databaseBlock.actionLabel,
      timelineEntry: buildImplementationDatabaseRequiredBlockedTimelineEntry({
        projectId: pid,
        handoff: imp.planningHandoffForImplementationV1 ?? null,
        nowIso,
      }),
    };
  }
  const prep = prepareSelectedCodeTaskIdsForQuickRun({
    codeTaskPlan: imp.implementationCodeTaskPlanV1,
    selectedCodeTaskIds:
      input.selectedCodeTaskIdsOverride ?? imp.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
    legacySelectedTaskIds: imp.implementationExecutionBoardStateV1?.selectedTaskIds,
  });

  if (prep.status === "blocked") {
    const nowIso = new Date().toISOString();
    const toastMessage =
      prep.message.split("\n")[0]?.trim() ?? QUICK_RUN_MOCK_CODE_TASK_ID_BLOCKED_MESSAGE;
    return {
      ok: false,
      kind: "mock_id_blocked",
      message: toastMessage,
      codeTaskId: prep.codeTaskId,
      timelineEntry: buildImplementationExecutionLogTimelineEntry({
        action: "quick_run_selected_mock_id_blocked",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { projectId: pid, codeTaskId: prep.codeTaskId },
        nowIso,
      }),
    };
  }

  const selectedRunnableFromBoard = resolveSelectedRunnableCodeTaskIdsForQuickRun({
    projectId: pid,
    requirementsState: imp,
    livePanelSummary: input.bridge.livePanelSummary,
    liveCheckedCodeTaskIds: input.bridge.liveCheckedCodeTaskIds,
    liveRunnableCodeTaskIds: input.bridge.liveRunnableCodeTaskIds,
    boardPersistSelection: input.bridge.boardPersistSelection,
    selectedCodeTaskIdsOverride: input.selectedCodeTaskIdsOverride ?? prep.selectedCodeTaskIds,
  });

  if (!selectedRunnableFromBoard.length) {
    const message =
      prep.selectedCodeTaskIds.length > 0
        ? "선택한 CodeTask 중 현재 실행할 수 있는 작업이 없습니다."
        : "실행할 CodeTask를 선택해 주세요.";
    return {
      ok: false,
      kind: "no_runnable_selection",
      message,
      phase: prep.selectedCodeTaskIds.length
        ? "blocked_no_runnable_selection"
        : "toolbar_blocked_no_selection",
      selectedCount: prep.selectedCodeTaskIds.length,
    };
  }

  return {
    ok: true,
    selectedRunnableCodeTaskIds: selectedRunnableFromBoard,
    repairs: prep.repairs.map((r) => ({
      fromCodeTaskId: r.fromCodeTaskId,
      toCodeTaskId: r.toCodeTaskId,
    })),
  };
}

export function buildImplementationQuickRunRequirementsPrepPersistPatch(input: {
  readonly prepared: ReturnType<typeof prepareRequirementsStateForImplementationQuickRun>;
}): Record<string, unknown> {
  const {
    requirementsState,
    planRepaired,
    appendedCodeTaskIds,
    patchedPromptContextCodeTaskIds,
    workItemsReconciled,
  } = input.prepared;
  const patch: Record<string, unknown> = {};
  if (planRepaired && requirementsState.implementationCodeTaskPlanV1) {
    patch.implementationCodeTaskPlanV1 = requirementsState.implementationCodeTaskPlanV1;
  }
  if (appendedCodeTaskIds.length || workItemsReconciled) {
    patch.cursorWorkItemsV1 = requirementsState.cursorWorkItemsV1;
  }
  if (patchedPromptContextCodeTaskIds.length && requirementsState.codeTaskPromptContextMapV1) {
    patch.codeTaskPromptContextMapV1 = requirementsState.codeTaskPromptContextMapV1;
  }
  return patch;
}

/** CodeTaskPlan 대비 누락된 prompt context map 항목을 보강한다. */
export function ensureRequirementsStateCodeTaskPromptContextForPlan(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly nowIso?: string;
}): Readonly<{
  readonly requirementsState: RequirementsStateJson;
  readonly patchedCodeTaskIds: readonly string[];
}> {
  const plan = input.requirementsState.implementationCodeTaskPlanV1;
  if (!plan?.tasks?.length) {
    return { requirementsState: input.requirementsState, patchedCodeTaskIds: [] };
  }
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const existingMap = parseCodeTaskPromptContextMapV1(
    input.requirementsState.codeTaskPromptContextMapV1,
  );
  const existingContexts = existingMap?.contexts ?? {};
  const idsNeedingContext = listCodeTaskPromptContextIdsToRefresh({
    plan,
    existingContexts,
  });
  if (!idsNeedingContext.length) {
    return { requirementsState: input.requirementsState, patchedCodeTaskIds: [] };
  }
  const built = buildCodeTaskPromptContextMap({
    projectId: pid,
    codeTaskPlan: plan,
    requirementsStateJson: input.requirementsState as Record<string, unknown>,
    nowIso,
  });
  const contexts: CodeTaskPromptContextMapV1["contexts"] = { ...existingContexts };
  const patchedCodeTaskIds: string[] = [];
  for (const id of idsNeedingContext) {
    const ctx = built.contexts[id];
    if (!ctx) continue;
    contexts[id] = ctx;
    patchedCodeTaskIds.push(id);
  }
  if (!patchedCodeTaskIds.length) {
    return { requirementsState: input.requirementsState, patchedCodeTaskIds: [] };
  }
  const mergedMap: CodeTaskPromptContextMapV1 = {
    ...(existingMap ?? built),
    projectId: pid,
    contexts,
    updatedAt: nowIso,
  };
  return {
    requirementsState: {
      ...input.requirementsState,
      codeTaskPromptContextMapV1: mergedMap,
    },
    patchedCodeTaskIds,
  };
}

/** CodeTaskPlan 대비 누락된 Cursor WorkItem을 보강한 requirementsState (빠른실행 dispatch용). */
export function ensureRequirementsStateCursorWorkItemsForCodeTaskPlan(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly nowIso?: string;
}): Readonly<{
  readonly requirementsState: RequirementsStateJson;
  readonly appendedCodeTaskIds: readonly string[];
}> {
  const plan = input.requirementsState.implementationCodeTaskPlanV1;
  if (!plan?.tasks?.length) {
    return { requirementsState: input.requirementsState, appendedCodeTaskIds: [] };
  }
  const merged = mergeCursorWorkItemsWithMissingCodeTaskPlanTasks({
    projectId: input.projectId.trim(),
    codeTaskPlan: plan,
    existingWorkItems: input.requirementsState.cursorWorkItemsV1 ?? [],
    nowIso: input.nowIso,
    originStage: "implementation",
  });
  if (!merged.appendedCodeTaskIds.length) {
    return { requirementsState: input.requirementsState, appendedCodeTaskIds: [] };
  }
  return {
    requirementsState: {
      ...input.requirementsState,
      cursorWorkItemsV1: [...merged.cursorWorkItems],
    },
    appendedCodeTaskIds: merged.appendedCodeTaskIds,
  };
}

/**
 * 실행 보드와 동일한 CodeTaskPlan 보정(경계·mock id 등) 후 WorkItem을 맞춘다.
 * 보드 UI만 `ensureCodeTaskPlanWithFileBoundaries`를 쓰고 저장 state는 구버전일 때 빠른실행 dispatch가 실패하는 것을 방지한다.
 */
export function prepareRequirementsStateForImplementationQuickRun(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly nowIso?: string;
}): Readonly<{
  readonly requirementsState: RequirementsStateJson;
  readonly appendedCodeTaskIds: readonly string[];
  readonly patchedPromptContextCodeTaskIds: readonly string[];
  readonly planRepaired: boolean;
  readonly workItemsReconciled: boolean;
}> {
  const taskList = input.requirementsState.implementationTaskListV1 ?? null;
  const rawPlan = input.requirementsState.implementationCodeTaskPlanV1 ?? null;
  const rawTasks = rawPlan?.tasks ?? [];
  const ensuredPlan =
    ensureCodeTaskPlanWithFileBoundaries({ plan: rawPlan, taskList }) ?? rawPlan;
  let state = input.requirementsState;
  let planForState = ensuredPlan;
  if (planForState) {
    planForState = repairSampleDataCodeTaskFileBoundariesInPlan(planForState);
  }
  let planRepaired = Boolean(planForState && rawPlan && planForState !== rawPlan);
  if (planForState) {
    state = { ...state, implementationCodeTaskPlanV1: planForState };
  }
  const idRemap = new Map(buildCodeTaskIdRemapFromPlanTasks(rawTasks, planForState?.tasks ?? rawTasks));
  augmentProductionCodeTaskIdRemap({
    remap: idRemap,
    repairedTasks: planForState?.tasks ?? rawTasks,
    runCodeTaskIds: (parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? []).map(
      (r) => r.codeTaskId,
    ),
  });
  const remappedRuns = remapCodeTaskExecutionRunsV1(
    parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [],
    idRemap,
  );
  if (remappedRuns !== (parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [])) {
    state = { ...state, codeTaskExecutionRunsV1: remappedRuns };
  }
  const reconciledItems = reconcileCursorWorkItemsWithCodeTaskIdRemap({
    workItems: state.cursorWorkItemsV1 ?? [],
    idRemap,
  });
  const workItemsReconciled = reconciledItems !== (state.cursorWorkItemsV1 ?? []);
  if (workItemsReconciled) {
    state = { ...state, cursorWorkItemsV1: [...reconciledItems] };
  }
  const workItemsEnsured = ensureRequirementsStateCursorWorkItemsForCodeTaskPlan({
    projectId: input.projectId,
    requirementsState: state,
    nowIso: input.nowIso,
  });
  state = workItemsEnsured.requirementsState;
  const promptContextEnsured = ensureRequirementsStateCodeTaskPromptContextForPlan({
    projectId: input.projectId,
    requirementsState: state,
    nowIso: input.nowIso,
  });
  return {
    requirementsState: promptContextEnsured.requirementsState,
    appendedCodeTaskIds: workItemsEnsured.appendedCodeTaskIds,
    patchedPromptContextCodeTaskIds: promptContextEnsured.patchedCodeTaskIds,
    planRepaired,
    workItemsReconciled,
  };
}

export function buildImplementationQuickRunQueueItems(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly requirementsState: RequirementsStateJson;
}): ReadonlyArray<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItemId: string | null;
}> {
  return input.selectedCodeTaskIds.map((codeTaskId) => {
    const target = resolveCodeTaskDispatchTarget({
      codeTaskId,
      codeTaskPlan: input.requirementsState.implementationCodeTaskPlanV1,
      taskList: input.requirementsState.implementationTaskListV1,
      cursorWorkItems: input.requirementsState.cursorWorkItemsV1,
    });
    return {
      codeTaskId,
      parentTaskId: target?.parentTaskId ?? codeTaskId,
      workItemId: target?.workItem.id ?? null,
    };
  });
}

export type QuickRunOrchestrationAfterJobStartV1 = Readonly<{
  readonly quickRun: ReturnType<typeof buildImplementationQuickRunStartedPatch>;
  readonly codeTaskExecutionRunsV1: readonly CodeTaskExecutionRunV1[];
  readonly runtimeUiSnapshotPatch: ReturnType<typeof buildPersistedActiveDispatchSnapshotPatch>;
  readonly dispatchTarget: NonNullable<ReturnType<typeof resolveCodeTaskDispatchTarget>>;
  readonly quickRunActiveDispatch: Readonly<{
    readonly codeTaskId: string;
    readonly parentTaskId: string;
    readonly workItemId: string;
    readonly runId: string;
  }>;
}>;

export function buildQuickRunOrchestrationAfterJobStart(input: {
  readonly projectId: string;
  readonly jobSelectedCodeTaskIds: readonly string[];
  readonly firstCodeTaskId?: string;
  readonly requirementsState: RequirementsStateJson;
  readonly requirementsStateJsonRaw: unknown;
  readonly executionSetup: ExecutionSetupSourceGenerationRow | null | undefined;
  readonly nowIso: string;
}): QuickRunOrchestrationAfterJobStartV1 | Readonly<{ readonly ok: false; readonly message: string }> {
  const pid = input.projectId.trim();
  const prepared = prepareRequirementsStateForImplementationQuickRun({
    projectId: pid,
    requirementsState: input.requirementsState,
    nowIso: input.nowIso,
  });
  const imp = prepared.requirementsState;
  const firstCodeTaskId =
    input.firstCodeTaskId?.trim() ?? input.jobSelectedCodeTaskIds[0]?.trim() ?? "";
  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: firstCodeTaskId,
    codeTaskPlan: imp.implementationCodeTaskPlanV1,
    taskList: imp.implementationTaskListV1,
    cursorWorkItems: imp.cursorWorkItemsV1,
  });
  if (!dispatchTarget) {
    return {
      ok: false,
      message: `CodeTask ${firstCodeTaskId}에 연결된 WorkItem을 찾을 수 없습니다.`,
    };
  }

  let codeTaskExecutionRunsV1 = parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoUrl: input.executionSetup?.gitRepoUrl,
    gitRepoName: input.executionSetup?.gitRepoName,
    gitRepoProvider: input.executionSetup?.gitRepoProvider,
    baseBranch: input.executionSetup?.baseBranch,
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
          baseBranch: input.executionSetup?.baseBranch ?? "main",
          allowedPathGlobs: parseStringArrayJson(input.executionSetup?.allowedPathGlobs),
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
          baseBranch: input.executionSetup?.baseBranch ?? targetRepository.defaultBranch ?? "main",
          allowedPathGlobs: parseStringArrayJson(input.executionSetup?.allowedPathGlobs),
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
    nowIso: input.nowIso,
  });
  codeTaskExecutionRunsV1 = appendCodeTaskExecutionRun(codeTaskExecutionRunsV1, quickRunNextRun);

  const codeTaskPlan = imp.implementationCodeTaskPlanV1;
  const quickRunParentTaskIds = [
    ...new Set(
      input.jobSelectedCodeTaskIds
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
    nowIso: input.nowIso,
  });
  const runtimeUiSnapshotPatch = buildPersistedActiveDispatchSnapshotPatch({
    projectId: pid,
    dispatch: {
      codeTaskId: dispatchTarget.codeTask.codeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      runId: quickRunNextRun.runId,
    },
    baseState: {
      ...(parseRequirementsStateJson(input.requirementsStateJsonRaw) as Record<string, unknown>),
      implementationQuickRunV1: quickRun,
      codeTaskExecutionRunsV1,
    },
    nowIso: input.nowIso,
  });

  return {
    quickRun,
    codeTaskExecutionRunsV1,
    runtimeUiSnapshotPatch,
    dispatchTarget,
    quickRunActiveDispatch: {
      codeTaskId: dispatchTarget.codeTask.codeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      runId: quickRunNextRun.runId,
    },
  };
}

export async function postImplementationQuickRunStartJob(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly queueItems: ReturnType<typeof buildImplementationQuickRunQueueItems>;
}): Promise<ImplementationRuntimeFetchResult> {
  if (typeof console !== "undefined" && console.info) {
    console.info("[quick-run] POST execute_selected_runnable_codetasks", {
      projectId: input.projectId,
      codeTaskCount: input.selectedCodeTaskIds.length,
      head: input.selectedCodeTaskIds[0],
    });
  }
  return postImplementationRuntimeAction({
    projectId: input.projectId,
    action: "execute_selected_runnable_codetasks",
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    queueItems: input.queueItems,
  });
}

export type ContinueQuickRunAfterStartInputV1 = Readonly<{
  readonly projectId: string;
  readonly imp: RequirementsStateJson;
  readonly startJobRes: ImplementationRuntimeFetchResult;
  readonly orchestration: QuickRunOrchestrationAfterJobStartV1;
  readonly nowIso: string;
  readonly enrichOrchestrationPatch: (patch: Record<string, unknown>) => Record<string, unknown>;
  readonly onDispatchPatch: (patch: Record<string, unknown>) => void;
  readonly persistAfterStart: (patch: Record<string, unknown>) => Promise<void>;
  readonly persistDispatchTimeline: (
    entry: ReturnType<typeof buildImplementationQuickRunCursorDispatchTimelineEntry>,
  ) => void;
  readonly showToast: (message: string) => void;
  readonly onRuntimeBundle: (bundle: NonNullable<ImplementationRuntimeFetchResult["bundle"]>) => void;
  readonly reloadRuntime: () => void;
  readonly clearDbQueuedDispatchKey: () => void;
}>;

export async function continueImplementationQuickRunAfterStart(
  input: ContinueQuickRunAfterStartInputV1,
): Promise<void> {
  const pid = input.projectId.trim();
  const { dispatchTarget, quickRun, codeTaskExecutionRunsV1, runtimeUiSnapshotPatch } =
    input.orchestration;

  try {
    let dispatchOutcome = input.startJobRes.quickRunDispatch?.outcome;
    let dispatchReason = input.startJobRes.quickRunDispatch?.reason ?? null;
    let dispatchOk = input.startJobRes.quickRunDispatch?.ok === true;
    let dispatchPatch = input.startJobRes.quickRunDispatch?.orchestrationPatch as
      | Record<string, unknown>
      | undefined;

    if (!dispatchOk) {
      const fallback = await postDbQueuedQuickRunAutoDispatch({ projectId: pid });
      dispatchOk = fallback.dispatchOk;
      dispatchOutcome = fallback.dispatchOutcome;
      dispatchReason = fallback.dispatchReason;
      dispatchPatch = fallback.orchestrationPatch;
    }

    if (dispatchPatch) {
      input.onDispatchPatch(input.enrichOrchestrationPatch(dispatchPatch));
    }

    await input.persistAfterStart({
      implementationQuickRunV1: quickRun,
      codeTaskExecutionRunsV1,
      implementationRuntimeUiSnapshotV1: runtimeUiSnapshotPatch,
      promptTimeline: appendPromptTimeline(
        input.imp.promptTimeline,
        buildImplementationQuickRunTimelineEntry({
          action: "implementation_quick_run_started",
          projectId: pid,
          codeTaskId: dispatchTarget.codeTask.codeTaskId,
          taskId: dispatchTarget.parentTaskId,
          nowIso: input.nowIso,
        }),
      ),
    });

    if (input.startJobRes.bundle) {
      input.onRuntimeBundle(input.startJobRes.bundle);
    }
    input.reloadRuntime();

    const dispatchNowIso = new Date().toISOString();
    input.persistDispatchTimeline(
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
    );

    if (dispatchOk || dispatchOutcome === "dispatched") {
      input.showToast(`CodeTask ${dispatchTarget.codeTask.codeTaskId} Cursor 실행을 시작했습니다.`);
    } else if (dispatchReason || dispatchOutcome === "skipped") {
      input.showToast(
        dispatchReason != null
          ? formatQuickRunContinuationReason(dispatchReason)
          : "Cursor 자동 실행이 건너뛰어졌습니다.",
      );
      input.clearDbQueuedDispatchKey();
    }
  } catch (error) {
    input.clearDbQueuedDispatchKey();
    const message = error instanceof Error ? error.message : String(error);
    input.showToast(`Cursor 실행 시작 실패: ${message}`);
  }
}

export function buildRepairTimelineEntries(input: {
  readonly projectId: string;
  readonly repairs: readonly QuickRunPrepRepairV1[];
  readonly nowIso: string;
}): readonly ReturnType<typeof buildImplementationExecutionLogTimelineEntry>[] {
  return input.repairs.map((repair) =>
    buildImplementationExecutionLogTimelineEntry({
      action: "quick_run_selected_mock_id_repaired",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: input.projectId,
        fromCodeTaskId: repair.fromCodeTaskId,
        toCodeTaskId: repair.toCodeTaskId,
      },
      nowIso: input.nowIso,
    }),
  );
}
