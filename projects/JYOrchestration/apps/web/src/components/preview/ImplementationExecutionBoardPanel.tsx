"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCurrentQueueCodeTaskId,
  parseCodeTaskExecutionQueueV1,
  resolveFirstIncompleteSelectedCodeTaskId,
} from "@/lib/prototype/codeTaskExecutionQueue";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildImplementationIntegratedPipelineLines,
} from "@/lib/prototype/implementationTaskPipelinePolicy";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  parseTaskCursorExecutionV1,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import {
  MANUAL_GITHUB_VERIFY_RETRY_LABEL,
  shouldShowManualGithubVerifyRetry,
} from "@/lib/prototype/implementationCodeTaskGithubVerifyRetryUi";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import {
  buildImplementationCodeTaskReworkVm,
  formatCodeTaskReworkRecommendedActionKo,
} from "@/lib/prototype/implementationCodeTaskReworkVm";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import { SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW } from "@/lib/prototype/implementationDeveloperPromptPreviewUi";
import { resolveStageTwoDeveloperPromptPreview } from "@/lib/prototype/resolveStageTwoDeveloperPromptPreview";
import type { CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { parseCodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  buildImplementationTaskTreeNodes,
  resolveImplementationExecutionBoardSelectedTaskId,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import type { ImplementationRuntimeStateV1 } from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationStageNextActionsBoardInput } from "@/lib/prototype/implementationStageNextActions";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { enrichCodeTaskRunForFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { deriveCodeTaskRunPhase } from "@/lib/prototype/codeTaskRunDerivedView";
import { resolveCursorSessionForRunPhase } from "@/lib/prototype/cursorSessionModel";
import {
  resolveCodeTaskStuckRecoveryHint,
  shouldShowCodeTaskStuckRecoveryPanel,
} from "@/lib/prototype/codeTaskStuckRecoveryUi";
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { ImplementationExecutionBoardTaskTree } from "@/components/preview/ImplementationExecutionBoardTaskTree";
import { buildCodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  isCodeTaskTreeFullySelected,
  normalizeSelectedCodeTaskIds,
  resolveCodeTaskTreeSelectAll,
  resolveCodeTaskTreeSelectionToggle,
  resolveParentTaskIdForCodeTask,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import {
  DEFAULT_CODE_TASK_TREE_SELECTION_MODE,
  evaluateIntegrationBoardSelectionGate,
  logCodeTaskSelectionModeResolved,
} from "@/lib/prototype/implementationCodeTaskSelectionPolicy";
import {
  logCodeTaskSelectionSummaryResolved,
  summarizeSelectableCodeTasks,
} from "@/lib/prototype/implementationCodeTaskSelectionSummary";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { IntegrationPreviewRemediationPanel } from "@/components/preview/IntegrationPreviewRemediationPanel";
import {
  resolveAutoGenerationReadyFromCapabilityJson,
} from "@/lib/prototype/autoGenerationSettingsState";
import { evaluateImplementationPreviewButtonState } from "@/lib/prototype/implementationPreviewButtonPolicy";
import { openActualIntegratedPreviewInNewWindow } from "@/lib/prototype/actualIntegratedPreviewOpenAction";
import type { ImplementationPreviewEntryModeV1 } from "@/lib/prototype/implementationPreviewEntryPolicy";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardPanel({
  board,
  taskList,
  executionSetup,
  codeAgentWipExecutionV1,
  taskCursorExecutionV1,
  taskCursorExecutionHistoryV1,
  implementationAutoQualityGateV1,
  implementationQuickRunV1,
  boardState,
  previewReady,
  boardInput,
  promptTimeline,
  activeTaskCursorJob,
  onRestartTask,
  onSelectedTaskIdsChange,
  onSelectedCodeTaskIdsChange,
  onCopyCodeTaskCursorPrompt,
  onCopyDeveloperPromptsFromHeader,
  onRetryGithubVerify,
  onRetryFailedCodeTask,
  projectId,
  implementationRuntimeStateV1,
  implementationRuntimeDbBundle,
  codeTaskExecutionFeedbackV1,
  implementationCodeTaskPlanV1,
  codeTaskPromptContextMapV1,
  cursorWorkItemsV1,
  runtimeCodeTaskQueueView,
  codeTaskExecutionRunsV1,
  implementationPreviewScopeV1,
  implementationPreviewRuntimeV1,
  onRunIntegrationPipeline,
  integrationPipelineBusy,
  codeTaskIntegrationPlanV1,
  implementationIntegrationStepsV1,
  onMergeIntegrationPullRequest,
  integrationMergeBusy,
  integrationPipelinePreviewReady,
  integrationPipelineStatus,
  onOpenImplementationPreview,
  onExecuteSelectedCodeTasks,
  onReworkSelectedCodeTasks,
}: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskList: ImplementationTaskListV1;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  readonly implementationQuickRunV1?: ImplementationQuickRunV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly previewReady?: boolean;
  readonly boardInput: ImplementationStageNextActionsBoardInput;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly activeTaskCursorJob?: TaskCursorJobSummary | null;
  readonly onRestartTask?: (taskId: string) => void;
  readonly onSelectedTaskIdsChange?: (selectedTaskIds: readonly string[]) => void;
  readonly onSelectedCodeTaskIdsChange?: (selectedCodeTaskIds: readonly string[]) => void;
  readonly onCopyCodeTaskCursorPrompt?: (codeTaskId: string) => void;
  readonly onCopyDeveloperPromptsFromHeader?: () => void;
  readonly onRetryGithubVerify?: () => void;
  readonly onRetryFailedCodeTask?: (codeTaskId: string) => void;
  readonly projectId?: string;
  readonly implementationRuntimeStateV1?: ImplementationRuntimeStateV1 | null;
  readonly codeTaskExecutionFeedbackV1?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly runtimeCodeTaskQueueView?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationPreviewScopeV1?: unknown;
  readonly implementationPreviewRuntimeV1?: unknown;
  readonly onRunIntegrationPipeline?: () => void;
  readonly integrationPipelineBusy?: boolean;
  readonly codeTaskIntegrationPlanV1?: unknown;
  readonly implementationIntegrationStepsV1?: unknown;
  readonly onMergeIntegrationPullRequest?: () => void;
  readonly integrationMergeBusy?: boolean;
  readonly integrationPipelinePreviewReady?: boolean;
  readonly integrationPipelineStatus?: string;
  readonly onOpenImplementationPreview?: (input: {
    readonly mode: ImplementationPreviewEntryModeV1;
    readonly url: string;
  }) => void;
  readonly onExecuteSelectedCodeTasks?: () => void;
  readonly onReworkSelectedCodeTasks?: () => void;
}) {
  const reworkVm = useMemo(
    () =>
      buildImplementationCodeTaskReworkVm({
        feedback: codeTaskExecutionFeedbackV1,
        codeTaskPlan: implementationCodeTaskPlanV1,
      }),
    [codeTaskExecutionFeedbackV1, implementationCodeTaskPlanV1],
  );

  const parsedCodeTaskPlan = useMemo(
    () => parseImplementationCodeTaskPlanV1(implementationCodeTaskPlanV1) ?? null,
    [implementationCodeTaskPlanV1],
  );
  const parsedPromptContextMap = useMemo(
    () => parseCodeTaskPromptContextMapV1(codeTaskPromptContextMapV1) ?? null,
    [codeTaskPromptContextMapV1],
  );

  const codeTaskQueue = useMemo(
    () => parseCodeTaskExecutionQueueV1(runtimeCodeTaskQueueView) ?? null,
    [runtimeCodeTaskQueueView],
  );

  const codeTaskRuns = useMemo(
    () => parseCodeTaskExecutionRunsV1(codeTaskExecutionRunsV1) ?? [],
    [codeTaskExecutionRunsV1],
  );

  const queueCurrentCodeTaskId = useMemo(() => {
    const runs = codeTaskRuns;
    const fromRuns = resolveFirstIncompleteSelectedCodeTaskId({
      queue: codeTaskQueue,
      runs,
    });
    if (fromRuns) return fromRuns;
    const fromQueue = getCurrentQueueCodeTaskId(codeTaskQueue);
    if (fromQueue) return fromQueue;
    return implementationRuntimeDbBundle?.job?.currentCodeTaskId?.trim() ?? null;
  }, [
    codeTaskQueue,
    codeTaskRuns,
    implementationRuntimeDbBundle?.job?.currentCodeTaskId,
  ]);

  const queueParentTaskId = useMemo(() => {
    if (!queueCurrentCodeTaskId) return null;
    return (
      implementationCodeTaskPlanV1?.tasks.find((t) => t.codeTaskId === queueCurrentCodeTaskId)
        ?.parentTaskId ?? null
    );
  }, [queueCurrentCodeTaskId, implementationCodeTaskPlanV1]);

  const activeTaskId = useMemo(
    () =>
      resolveImplementationExecutionBoardSelectedTaskId({
        board,
        codeAgentWipExecutionV1,
        taskCursorExecutionV1,
        queueParentTaskId,
      }),
    [board, codeAgentWipExecutionV1, taskCursorExecutionV1, queueParentTaskId],
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(activeTaskId);
  const [selectedCodeTaskId, setSelectedCodeTaskId] = useState<string | null>(null);

  const targetRepository = useMemo(
    () =>
      resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: executionSetup?.gitRepoUrl,
        gitRepoName: executionSetup?.gitRepoName,
        gitRepoProvider: executionSetup?.gitRepoProvider,
        baseBranch: executionSetup?.baseBranch,
      }),
    [executionSetup],
  );

  const executionTargetCodeTaskId = useMemo(
    () =>
      resolveExecutionTargetCodeTaskId({
        selectedCodeTaskId,
        runtimeCurrentCodeTaskId: queueCurrentCodeTaskId,
        codeTaskPlan: parsedCodeTaskPlan,
      }),
    [selectedCodeTaskId, queueCurrentCodeTaskId, parsedCodeTaskPlan],
  );

  const stageTwoDeveloperPromptPreview = useMemo(() => {
    if (!SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW) {
      return {
        codeTaskId: null,
        title: null,
        branchGroup: null,
        baseBranch: null,
        workBranch: null,
        preview: "",
        ready: false,
      };
    }
    return resolveStageTwoDeveloperPromptPreview({
      projectId: projectId?.trim() ?? board.projectId,
      codeTaskPlan: parsedCodeTaskPlan,
      taskList,
      codeTaskPromptContextMapV1: parsedPromptContextMap,
      targetRepository,
      selectedCodeTaskId,
      runtimeCurrentCodeTaskId: queueCurrentCodeTaskId,
      allowedPathGlobs: parseStringArrayJson(executionSetup?.allowedPathGlobs),
    });
  }, [
    projectId,
    board.projectId,
    parsedCodeTaskPlan,
    taskList,
    parsedPromptContextMap,
    targetRepository,
    selectedCodeTaskId,
    queueCurrentCodeTaskId,
    executionSetup?.allowedPathGlobs,
  ]);

  const checkedCodeTaskIds = useMemo(
    () =>
      normalizeSelectedCodeTaskIds({
        selectedCodeTaskIds: boardState?.selectedCodeTaskIds,
        codeTaskPlan: implementationCodeTaskPlanV1,
        legacySelectedTaskIds: boardState?.selectedTaskIds,
      }),
    [
      boardState?.selectedCodeTaskIds,
      boardState?.selectedTaskIds,
      implementationCodeTaskPlanV1,
    ],
  );

  const codeTaskSummaryCounts = useMemo(
    () => {
      const summary = buildImplementationExecutionSummaryCounts({
        projectId,
        requirementsState: {
          implementationCodeTaskPlanV1: implementationCodeTaskPlanV1 ?? undefined,
          codeTaskExecutionRunsV1: codeTaskRuns,
          implementationExecutionBoardStateV1: boardState ?? undefined,
          implementationIntegrationStepsV1: implementationIntegrationStepsV1 ?? undefined,
          codeTaskIntegrationPlanV1: codeTaskIntegrationPlanV1 ?? undefined,
        },
        codeTaskPlan: implementationCodeTaskPlanV1,
        selectedCodeTaskIds: checkedCodeTaskIds,
        legacySelectedTaskIds: boardState?.selectedTaskIds,
        runs: codeTaskRuns,
        workItemCount: cursorWorkItemsV1?.length ?? 0,
        previewRuntime: parseImplementationPreviewRuntimeV1(implementationPreviewRuntimeV1) ?? null,
      });
      return summary;
    },
    [
      projectId,
      implementationCodeTaskPlanV1,
      checkedCodeTaskIds,
      boardState,
      codeTaskRuns,
      cursorWorkItemsV1?.length,
      implementationPreviewRuntimeV1,
      implementationIntegrationStepsV1,
      codeTaskIntegrationPlanV1,
    ],
  );

  const runtimeSnapshot = codeTaskSummaryCounts.runtimeSnapshot;

  const displaySelectedCodeTaskIds = checkedCodeTaskIds;

  useEffect(() => {
    const reconciled = codeTaskSummaryCounts.reconciledSelectedCodeTaskIds;
    if (!codeTaskSummaryCounts.removedStaleSelectedIds.length) return;
    if (
      reconciled.length === checkedCodeTaskIds.length &&
      reconciled.every((id, i) => id === checkedCodeTaskIds[i])
    ) {
      return;
    }
    onSelectedCodeTaskIdsChange?.(reconciled);
  }, [
    codeTaskSummaryCounts.reconciledSelectedCodeTaskIds,
    codeTaskSummaryCounts.removedStaleSelectedIds.length,
    checkedCodeTaskIds,
    onSelectedCodeTaskIdsChange,
  ]);

  useEffect(() => {
    setSelectedTaskId((current) => current ?? activeTaskId);
  }, [activeTaskId]);

  const updateCheckedCodeTaskIds = (nextSelectedCodeTaskIds: readonly string[]) => {
    onSelectedCodeTaskIdsChange?.(nextSelectedCodeTaskIds);
  };

  const activeCodeTaskRun = useMemo(() => {
    const codeTaskId =
      selectedCodeTaskId ??
      queueCurrentCodeTaskId ??
      (activeTaskId
        ? implementationCodeTaskPlanV1?.tasks.find((t) => t.parentTaskId === activeTaskId)?.codeTaskId
        : null);
    if (!codeTaskId) return null;
    const parentTaskId =
      implementationCodeTaskPlanV1?.tasks.find((t) => t.codeTaskId === codeTaskId)?.parentTaskId ??
      activeTaskId;
    const executionForParent = parentTaskId
      ? resolveTaskCursorExecutionForRow({
          taskId: parentTaskId,
          taskCursorExecutionV1: taskCursorExecutionV1 ?? null,
          taskCursorExecutionHistoryV1: taskCursorExecutionHistoryV1,
        })
      : null;
    const dbRun =
      implementationRuntimeDbBundle?.currentRun?.codeTaskId === codeTaskId
        ? implementationRuntimeDbBundle.currentRun
        : (implementationRuntimeDbBundle?.runs.find((run) => run.codeTaskId === codeTaskId) ??
          null);
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: findLatestRunForCodeTask(codeTaskRuns, codeTaskId),
      execution: executionForParent,
      dbRun,
    });
    const run = enriched ?? findLatestRunForCodeTask(codeTaskRuns, codeTaskId);
    const dbCommit = dbRun?.commitSha?.trim() ?? "";
    return run
      ? {
          commitSha: dbCommit || run.commitSha,
          branchHeadCommitSha: dbCommit || run.branchHeadCommitSha,
          cursorRunId: run.cursorRunId ?? dbRun?.cursorAgentId ?? undefined,
          workBranch: run.workBranch ?? dbRun?.branchName ?? undefined,
        }
      : null;
  }, [
    selectedCodeTaskId,
    activeTaskId,
    queueCurrentCodeTaskId,
    implementationCodeTaskPlanV1,
    codeTaskRuns,
    taskCursorExecutionV1,
    taskCursorExecutionHistoryV1,
    implementationRuntimeDbBundle,
  ]);

  const activeFlowPhase = useMemo(() => {
    const codeTaskId = selectedCodeTaskId ?? queueCurrentCodeTaskId;
    if (!codeTaskId) return null;
    const parentTaskId =
      implementationCodeTaskPlanV1?.tasks.find((t) => t.codeTaskId === codeTaskId)?.parentTaskId ??
      queueParentTaskId ??
      "";
    if (!parentTaskId.trim()) return null;
    const executionForParent = resolveTaskCursorExecutionForRow({
      taskId: parentTaskId,
      taskCursorExecutionV1: parseTaskCursorExecutionV1(taskCursorExecutionV1),
      taskCursorExecutionHistoryV1: taskCursorExecutionHistoryV1 ?? null,
    });
    const dbRun =
      implementationRuntimeDbBundle?.currentRun?.codeTaskId === codeTaskId
        ? implementationRuntimeDbBundle.currentRun
        : (implementationRuntimeDbBundle?.runs.find((run) => run.codeTaskId === codeTaskId) ??
          null);
    const latestRun = enrichCodeTaskRunForFlowPhase({
      run: findLatestRunForCodeTask(codeTaskRuns, codeTaskId),
      execution: executionForParent,
      dbRun,
    });
    const autoGateForParent =
      implementationAutoQualityGateV1?.taskId === parentTaskId
        ? implementationAutoQualityGateV1
        : null;
    const runForPhase =
      latestRun ??
      ({
        runId: "pending",
        version: "code_task_execution_run_v1",
        projectId: board.projectId,
        processTaskId: parentTaskId,
        workItemId: "",
        codeTaskId,
        status: "queued",
        attemptNo: 1,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      } as const);
    return deriveCodeTaskRunPhase({
      run: runForPhase,
      cursorSession: resolveCursorSessionForRunPhase(executionForParent, latestRun),
      autoGate: autoGateForParent,
      dbRun,
    });
  }, [
    selectedCodeTaskId,
    queueCurrentCodeTaskId,
    queueParentTaskId,
    implementationCodeTaskPlanV1,
    codeTaskRuns,
    taskCursorExecutionV1,
    taskCursorExecutionHistoryV1,
    implementationRuntimeDbBundle,
    implementationAutoQualityGateV1,
  ]);

  const showStuckRecovery = useMemo(
    () =>
      shouldShowCodeTaskStuckRecoveryPanel({
        flowPhase: activeFlowPhase,
        taskCursor: parseTaskCursorExecutionV1(taskCursorExecutionV1),
      }),
    [activeFlowPhase, taskCursorExecutionV1],
  );

  const stuckRecoveryHint = useMemo(
    () =>
      resolveCodeTaskStuckRecoveryHint({
        flowPhase: activeFlowPhase,
        workBranch: activeCodeTaskRun?.workBranch,
      }),
    [activeFlowPhase, activeCodeTaskRun?.workBranch],
  );

  const taskTreeNodes = useMemo(
    () =>
      buildImplementationTaskTreeNodes({
        board,
        codeTaskPlan: implementationCodeTaskPlanV1,
        cursorWorkItems: cursorWorkItemsV1,
        codeTaskExecutionRuns: parseCodeTaskExecutionRunsV1(codeTaskExecutionRunsV1) ?? [],
        activeTaskId,
        selectedTaskId,
        selectedCodeTaskId,
        checkedCodeTaskIds: displaySelectedCodeTaskIds,
        taskCursorExecution: taskCursorExecutionV1 ?? null,
        taskCursorExecutionHistory: taskCursorExecutionHistoryV1 ?? null,
        dbRuntimeRuns: implementationRuntimeDbBundle?.runs ?? null,
        dbCurrentRun: implementationRuntimeDbBundle?.currentRun ?? null,
        implementationAutoQualityGateV1,
        promptTimeline,
        serverJob: activeTaskCursorJob ?? null,
        sequentialQuickRunCodeTaskIds:
          implementationRuntimeDbBundle?.job?.status === "running"
            ? (implementationRuntimeDbBundle.job.selectedCodeTaskIds ?? [])
            : null,
        executionUnits: codeTaskSummaryCounts.executionUnits,
        runtimeSnapshotUnits: runtimeSnapshot.units,
      }),
    [
      board,
      implementationCodeTaskPlanV1,
      cursorWorkItemsV1,
      codeTaskExecutionRunsV1,
      activeTaskId,
      selectedTaskId,
      selectedCodeTaskId,
      displaySelectedCodeTaskIds,
      taskCursorExecutionV1,
      taskCursorExecutionHistoryV1,
      implementationRuntimeDbBundle,
      implementationAutoQualityGateV1,
      promptTimeline,
      activeTaskCursorJob,
      codeTaskSummaryCounts.executionUnits,
      runtimeSnapshot.units,
    ],
  );

  const taskTreeProgressByCodeTaskId = useMemo(() => {
    const map = new Map<string, { statusLabel: string; progressLabel: string }>();
    for (const unit of runtimeSnapshot.units) {
      map.set(unit.codeTaskId, {
        statusLabel: unit.statusLabel,
        progressLabel: unit.progressLabel,
      });
    }
    return map;
  }, [runtimeSnapshot.units]);

  const taskTreeSelectionContext = useMemo(
    () => ({
      mode: DEFAULT_CODE_TASK_TREE_SELECTION_MODE,
      units: codeTaskSummaryCounts.executionUnits,
      runs: codeTaskRuns,
      progressByCodeTaskId: taskTreeProgressByCodeTaskId,
    }),
    [
      codeTaskSummaryCounts.executionUnits,
      codeTaskRuns,
      taskTreeProgressByCodeTaskId,
    ],
  );

  const visibleCodeTaskIds = useMemo(
    () => taskTreeNodes.map((node) => node.codeTaskId),
    [taskTreeNodes],
  );

  const codeTaskSelectionSummary = useMemo(
    () =>
      summarizeSelectableCodeTasks({
        codeTasks: implementationCodeTaskPlanV1?.tasks ?? [],
        selectedCodeTaskIds: checkedCodeTaskIds,
        mode: DEFAULT_CODE_TASK_TREE_SELECTION_MODE,
        units: codeTaskSummaryCounts.executionUnits,
        runs: codeTaskRuns,
        progressByCodeTaskId: taskTreeProgressByCodeTaskId,
        visibleCodeTaskIds,
      }),
    [
      implementationCodeTaskPlanV1,
      checkedCodeTaskIds,
      codeTaskSummaryCounts.executionUnits,
      codeTaskRuns,
      taskTreeProgressByCodeTaskId,
      visibleCodeTaskIds,
    ],
  );

  useEffect(() => {
    logCodeTaskSelectionModeResolved({
      projectId: projectId ?? board.projectId,
      mode: DEFAULT_CODE_TASK_TREE_SELECTION_MODE,
      selectableCount: codeTaskSelectionSummary.selectableCount,
    });
    logCodeTaskSelectionSummaryResolved({
      projectId: projectId ?? board.projectId,
      summary: codeTaskSelectionSummary,
    });
  }, [projectId, board.projectId, codeTaskSelectionSummary]);

  const allCodeTasksChecked = useMemo(
    () =>
      isCodeTaskTreeFullySelected({
        selectedCodeTaskIds: checkedCodeTaskIds,
        codeTaskPlan: implementationCodeTaskPlanV1,
        visibleCodeTaskIds,
        ...taskTreeSelectionContext,
      }),
    [checkedCodeTaskIds, implementationCodeTaskPlanV1, visibleCodeTaskIds, taskTreeSelectionContext],
  );

  const integratedPipelineLines = useMemo(
    () => buildImplementationIntegratedPipelineLines(board.integratedRows),
    [board.integratedRows],
  );

  const parsedPreviewRuntime = useMemo(
    () => parseImplementationPreviewRuntimeV1(implementationPreviewRuntimeV1) ?? null,
    [implementationPreviewRuntimeV1],
  );

  const parsedIntegrationPlan = useMemo(
    () => parseCodeTaskIntegrationPlanV1(codeTaskIntegrationPlanV1) ?? null,
    [codeTaskIntegrationPlanV1],
  );

  const integrationRequirementsState = useMemo(
    () => ({
      implementationCodeTaskPlanV1: implementationCodeTaskPlanV1 ?? undefined,
      codeTaskExecutionRunsV1: codeTaskRuns,
      implementationIntegrationStepsV1: implementationIntegrationStepsV1 ?? undefined,
      codeTaskIntegrationPlanV1: codeTaskIntegrationPlanV1 ?? undefined,
      implementationExecutionUnitsV1: projectId
        ? {
            version: "implementation_execution_units_v1" as const,
            projectId,
            updatedAt: new Date().toISOString(),
            units: codeTaskSummaryCounts.executionUnits,
            selectedExecutionUnitIds: codeTaskSummaryCounts.selectedExecutionUnitIds,
          }
        : undefined,
    }),
    [
      implementationCodeTaskPlanV1,
      codeTaskRuns,
      implementationIntegrationStepsV1,
      codeTaskIntegrationPlanV1,
      projectId,
      codeTaskSummaryCounts.executionUnits,
      codeTaskSummaryCounts.selectedExecutionUnitIds,
    ],
  );

  const integrationSection = useMemo(
    () =>
      buildImplementationIntegrationBoardSection({
        projectId: projectId ?? board.projectId,
        codeTaskPlan: implementationCodeTaskPlanV1 ?? null,
        codeTaskRuns,
        requirementsState: integrationRequirementsState,
        eligibility: evaluateCodeTaskIntegration({
          codeTaskPlan: implementationCodeTaskPlanV1 ?? null,
          taskList,
          codeTaskRuns,
          taskCursorExecution: taskCursorExecutionV1 ?? null,
          taskCursorExecutionHistory: taskCursorExecutionHistoryV1 ?? null,
          autoQualityGate: implementationAutoQualityGateV1 ?? null,
        }),
        integratedPipelineLines,
        previewScope: parseImplementationPreviewScopeV1(implementationPreviewScopeV1),
        previewRuntime: parsedPreviewRuntime,
        integrationPlan: parsedIntegrationPlan,
        runtimeSnapshot,
        integrationPipelinePreviewReady,
        integrationPipelineStatus,
      }),
    [
      projectId,
      board.projectId,
      implementationCodeTaskPlanV1,
      taskList,
      codeTaskRuns,
      taskCursorExecutionV1,
      taskCursorExecutionHistoryV1,
      implementationAutoQualityGateV1,
      integratedPipelineLines,
      implementationPreviewScopeV1,
      parsedPreviewRuntime,
      parsedIntegrationPlan,
      integrationRequirementsState,
      runtimeSnapshot,
      integrationPipelinePreviewReady,
      integrationPipelineStatus,
    ],
  );

  const autoGenerationReady = useMemo(
    () => resolveAutoGenerationReadyFromCapabilityJson(executionSetup?.githubCapabilityValidation ?? null),
    [executionSetup?.githubCapabilityValidation],
  );

  const integrationButtonState = useMemo(
    () => {
      const fromSnapshot = evaluateIntegrationPipelineButtonFromSnapshot(runtimeSnapshot, {
        autoGenerationReady,
        isIntegrationRunning: integrationPipelineBusy === true,
        latestPipelineStatus: integrationPipelineStatus,
        projectId: projectId ?? board.projectId,
      });
      const integrationSelectionGate = evaluateIntegrationBoardSelectionGate({
        selectedCodeTaskIds: checkedCodeTaskIds,
        codeTasks: implementationCodeTaskPlanV1?.tasks ?? [],
        units: codeTaskSummaryCounts.executionUnits,
        runs: codeTaskRuns,
      });
      if (!integrationSelectionGate.ok && fromSnapshot.show) {
        return {
          ...fromSnapshot,
          enabled: false,
          disabledTitle: integrationSelectionGate.message,
          disabledReasonLines: integrationSelectionGate.message
            ? integrationSelectionGate.message.split("\n")
            : fromSnapshot.disabledReasonLines,
          userStatusLines: integrationSelectionGate.message
            ? integrationSelectionGate.message.split("\n")
            : fromSnapshot.userStatusLines,
        };
      }
      return fromSnapshot;
    },
    [
      runtimeSnapshot,
      autoGenerationReady,
      integrationPipelineBusy,
      integrationPipelineStatus,
      projectId,
      board.projectId,
      checkedCodeTaskIds,
      implementationCodeTaskPlanV1,
      codeTaskSummaryCounts.executionUnits,
      codeTaskRuns,
    ],
  );

  const boardPrimaryAction = useMemo(
    () =>
      resolveImplementationBoardPrimaryAction({
        selectedCodeTaskIds: checkedCodeTaskIds,
        codeTasks: implementationCodeTaskPlanV1?.tasks ?? [],
        units: codeTaskSummaryCounts.executionUnits,
        runs: codeTaskRuns,
        progressByCodeTaskId: taskTreeProgressByCodeTaskId,
        integratedAppPreviewReady: integrationSection.integratedAppPreviewReady,
        integrationPrepareEnabled: integrationButtonState.enabled,
      }),
    [
      checkedCodeTaskIds,
      implementationCodeTaskPlanV1,
      codeTaskSummaryCounts.executionUnits,
      codeTaskRuns,
      taskTreeProgressByCodeTaskId,
      integrationSection.integratedAppPreviewReady,
      integrationButtonState.enabled,
    ],
  );

  const showIntegrationButton =
    integrationButtonState.show && boardPrimaryAction.showIntegrationPrepareButton;
  const integrationButtonEnabled = integrationButtonState.enabled;

  const previewButtonState = useMemo(
    () =>
      evaluateImplementationPreviewButtonState({
        projectId: projectId ?? board.projectId,
        snapshot: runtimeSnapshot,
        previewRuntime: parsedPreviewRuntime,
        codeTaskPreviewReady: integrationSection.codeTaskPreviewReady,
        integratedAppPreviewReady: integrationSection.integratedAppPreviewReady,
        integrationPlan: parsedIntegrationPlan,
        requirementsState: integrationRequirementsState,
        pipelinePreviewReady: integrationPipelinePreviewReady,
        pipelineStatus: integrationPipelineStatus,
      }),
    [
      projectId,
      board.projectId,
      runtimeSnapshot,
      parsedPreviewRuntime,
      integrationSection.codeTaskPreviewReady,
      integrationSection.integratedAppPreviewReady,
      parsedIntegrationPlan,
      integrationRequirementsState,
      integrationPipelinePreviewReady,
      integrationPipelineStatus,
    ],
  );

  const codeAgentProgress = useMemo(
    () =>
      buildCodeAgentExecutionProgressView({
        codeAgentWipExecutionV1,
        taskCursorExecutionV1,
        board,
        latestTimeline: promptTimeline,
        implementationAutoQualityGateV1,
      }),
    [codeAgentWipExecutionV1, taskCursorExecutionV1, board, promptTimeline, implementationAutoQualityGateV1],
  );

  const [reworkOpen, setReworkOpen] = useState(false);

  const showManualGithubVerifyRetry = useMemo(
    () =>
      shouldShowManualGithubVerifyRetry({
        queue: codeTaskQueue,
        runs: codeTaskRuns,
        currentCodeTaskId: queueCurrentCodeTaskId,
        taskCursor: parseTaskCursorExecutionV1(taskCursorExecutionV1),
      }),
    [codeTaskQueue, codeTaskRuns, queueCurrentCodeTaskId, taskCursorExecutionV1],
  );

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      <div className={styles.summaryCard}>
        {showStuckRecovery ? (
          <div className={styles.runtimeAdminActions} data-testid="code-task-stuck-recovery">
            {stuckRecoveryHint ? (
              <span className={styles.githubVerifyAutoStatus}>{stuckRecoveryHint}</span>
            ) : null}
            <div className={styles.stuckRecoveryActions}>
              {onRetryGithubVerify ? (
                <button type="button" className={styles.githubVerifyRetryLink} onClick={onRetryGithubVerify}>
                  상태 재확인
                </button>
              ) : null}
              {onRestartTask && queueParentTaskId ? (
                <button
                  type="button"
                  className={styles.githubVerifyRetryLink}
                  onClick={() => onRestartTask(queueParentTaskId)}
                >
                  이 CodeTask 재실행
                </button>
              ) : null}
              {projectId && (selectedCodeTaskId ?? queueCurrentCodeTaskId) ? (
                <button
                  type="button"
                  className={styles.githubVerifyRetryLink}
                  onClick={() => {
                    const codeTaskId = (selectedCodeTaskId ?? queueCurrentCodeTaskId)!.trim();
                    void fetch(`/api/projects/${projectId.trim()}/implementation-runtime/actions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "skip_code_task", codeTaskId }),
                    });
                  }}
                >
                  이 CodeTask 건너뛰기
                </button>
              ) : null}
              {projectId ? (
                <button
                  type="button"
                  className={styles.githubVerifyRetryLink}
                  onClick={() => {
                    void fetch(`/api/projects/${projectId.trim()}/implementation-runtime/actions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "cancel_selected_quick_run" }),
                    });
                  }}
                >
                  선택 실행 중단
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {showManualGithubVerifyRetry ? (
          <div className={styles.runtimeAdminActions} data-testid="code-task-github-verify-auto">
            <span className={styles.githubVerifyAutoStatus}>
              GitHub push 여부를 플랫폼이 자동 확인 중입니다. (Cursor 시작 후 60초 뒤 1회, 이후 10초마다)
            </span>
            {onRetryGithubVerify ? (
              <button
                type="button"
                className={styles.githubVerifyRetryLink}
                onClick={onRetryGithubVerify}
              >
                {MANUAL_GITHUB_VERIFY_RETRY_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
        {reworkVm?.candidateCount ? (
          <div className={styles.reworkSummary}>
            <button
              type="button"
              className={styles.reworkToggle}
              aria-expanded={reworkOpen}
              onClick={() => setReworkOpen((open) => !open)}
            >
              {reworkOpen ? "재작업 후보 닫기" : `재작업 후보 ${reworkVm.candidateCount}개 보기`}
            </button>
            {reworkOpen ? (
              <ul className={styles.reworkList}>
                {reworkVm.candidates.map((candidate) => (
                  <li key={candidate.codeTaskId} className={styles.reworkItem}>
                    <div>
                      {candidate.parentTaskId} · {candidate.codeTaskId}
                      {candidate.title ? ` · ${candidate.title}` : ""}
                    </div>
                    <div className={styles.reworkMeta}>
                      {candidate.causeLayer ? `원인: ${candidate.causeLayer}` : null}
                      {candidate.failureReason ? ` · ${candidate.failureReason}` : null}
                    </div>
                    <div className={styles.reworkMeta}>
                      권장: {formatCodeTaskReworkRecommendedActionKo(candidate.recommendedAction)}
                      {candidate.recommendedAction === "rerun_task" && onRestartTask ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className={styles.reworkActionLink}
                            onClick={() => onRestartTask(candidate.parentTaskId)}
                          >
                            Task 재실행
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {parsedCodeTaskPlan && SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW ? (
        <section className={styles.taskTreeSection} data-testid="implementation-stage-two-developer-prompt">
          <div className={styles.integrationSectionHeader}>
            <strong>현재 CodeTask 개발 프롬프트 (2단계 · Cursor 전달용)</strong>
          </div>
          {executionTargetCodeTaskId ? (
            <div className={styles.summarySecondary}>
              <div>{executionTargetCodeTaskId}</div>
              {stageTwoDeveloperPromptPreview.title ? (
                <div>{stageTwoDeveloperPromptPreview.title}</div>
              ) : null}
              {stageTwoDeveloperPromptPreview.branchGroup ? (
                <div>
                  branch group: {stageTwoDeveloperPromptPreview.branchGroup} · base branch:{" "}
                  {stageTwoDeveloperPromptPreview.baseBranch} · work branch:{" "}
                  {stageTwoDeveloperPromptPreview.workBranch}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.summarySecondary}>실행 대상 CodeTask를 선택해 주세요.</div>
          )}
          {stageTwoDeveloperPromptPreview.preview ? (
            <pre
              className={styles.summarySecondary}
              data-testid="implementation-stage-two-developer-prompt-preview"
              style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}
            >
              {stageTwoDeveloperPromptPreview.preview.slice(0, 4000)}
            </pre>
          ) : null}
        </section>
      ) : null}

      <section className={styles.taskTreeSection} data-testid="implementation-task-tree-section">
        <ImplementationExecutionBoardTaskTree
          nodes={taskTreeNodes}
          selectedCodeTaskId={selectedCodeTaskId}
          codeAgentProgress={codeAgentProgress}
          allChecked={allCodeTasksChecked}
          selectedCodeTaskCount={checkedCodeTaskIds.length}
          selectableCodeTaskCount={codeTaskSelectionSummary.runnableCount}
          integrationReadyCount={codeTaskSelectionSummary.integrationReadyCount}
          onSelectCodeTask={(parentTaskId, codeTaskId) => {
            setSelectedTaskId(parentTaskId);
            setSelectedCodeTaskId(codeTaskId);
          }}
          onToggleCodeTaskChecked={(codeTaskId, checked) => {
            const parentTaskId = resolveParentTaskIdForCodeTask({
              codeTaskId,
              codeTaskPlan: implementationCodeTaskPlanV1,
            });
            if (parentTaskId) {
              setSelectedTaskId(parentTaskId);
            }
            if (checked) {
              setSelectedCodeTaskId(codeTaskId);
            }
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectionToggle({
                codeTaskId,
                checked,
                selectedCodeTaskIds: displaySelectedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
                ...taskTreeSelectionContext,
              }),
            );
          }}
          onToggleSelectAll={(checked) => {
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectAll({
                selectAll: checked,
                codeTaskPlan: implementationCodeTaskPlanV1,
                visibleCodeTaskIds,
                ...taskTreeSelectionContext,
              }),
            );
          }}
          onCopyCodeTaskCursorPrompt={onCopyCodeTaskCursorPrompt}
          onRetryFailedCodeTask={onRetryFailedCodeTask}
          onCopyDeveloperPromptsFromHeader={onCopyDeveloperPromptsFromHeader}
          developerPromptHeaderCopyDisabled={
            !executionTargetCodeTaskId &&
            codeTaskSummaryCounts.selectedCodeTaskCount === 0
          }
        />
      </section>

      {(boardPrimaryAction.showExecuteSelectedButton ||
        boardPrimaryAction.showReworkSelectedButton) &&
      (onExecuteSelectedCodeTasks || onReworkSelectedCodeTasks) ? (
        <section
          className={styles.taskTreeSection}
          data-testid="implementation-execution-primary-action-section"
        >
          <div className={styles.integrationSectionHeader}>
            <div className={styles.integrationSectionActions}>
              {boardPrimaryAction.showExecuteSelectedButton && onExecuteSelectedCodeTasks ? (
                <button
                  type="button"
                  className={styles.integrationPrimaryButton}
                  data-testid="implementation-execute-selected-button"
                  disabled={!boardPrimaryAction.primaryEnabled}
                  title={boardPrimaryAction.primaryDisabledTitle ?? undefined}
                  onClick={onExecuteSelectedCodeTasks}
                >
                  {boardPrimaryAction.primaryLabel ?? "선택 작업 실행"}
                </button>
              ) : null}
              {boardPrimaryAction.showReworkSelectedButton && onReworkSelectedCodeTasks ? (
                <button
                  type="button"
                  className={styles.integrationPrimaryButton}
                  data-testid="implementation-rework-selected-button"
                  disabled={!boardPrimaryAction.primaryEnabled}
                  title={boardPrimaryAction.primaryDisabledTitle ?? undefined}
                  onClick={onReworkSelectedCodeTasks}
                >
                  {boardPrimaryAction.primaryLabel ?? "선택 작업 재작업"}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {integrationSection.showSection ? (
        <section
          className={styles.taskTreeSection}
          data-testid="implementation-integrated-pipeline-section"
        >
          <div className={styles.integrationSectionHeader}>
            <div className={styles.integrationSectionActions}>
              {showIntegrationButton && onRunIntegrationPipeline ? (
                <button
                  type="button"
                  className={styles.integrationPrimaryButton}
                  data-testid="implementation-integration-run-button"
                  disabled={integrationPipelineBusy === true || !integrationButtonEnabled}
                  aria-disabled={integrationPipelineBusy === true || !integrationButtonEnabled}
                  title={integrationButtonState.disabledTitle ?? undefined}
                  onClick={onRunIntegrationPipeline}
                >
                  {integrationPipelineBusy
                    ? integrationButtonState.buttonLabel === "Preview 준비 계속"
                      ? "Preview 준비 계속 중…"
                      : integrationButtonState.continueBuildPreview
                        ? "Build 검증 및 Preview 준비 계속 중…"
                        : "통합 및 Preview 준비 중…"
                    : integrationButtonState.buttonLabel}
                </button>
              ) : null}
              {integrationSection.integrationPullRequestUrl ? (
                <button
                  type="button"
                  className={styles.integrationPreviewScopeButton}
                  data-testid="implementation-integration-pr-open-button"
                  onClick={() => {
                    window.open(
                      integrationSection.integrationPullRequestUrl!,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  PR 열기
                </button>
              ) : null}
              {integrationSection.canMergeIntegrationPullRequest &&
              onMergeIntegrationPullRequest ? (
                <button
                  type="button"
                  className={styles.integrationPrimaryButton}
                  data-testid="implementation-integration-merge-main-button"
                  disabled={integrationMergeBusy === true}
                  onClick={onMergeIntegrationPullRequest}
                >
                  {integrationMergeBusy ? "main 반영 중…" : "main에 반영"}
                </button>
              ) : null}
              {previewButtonState.show ? (
                <button
                  type="button"
                  className={styles.integrationPreviewButton}
                  data-testid="implementation-preview-open-button"
                  disabled={!previewButtonState.enabled || !previewButtonState.url}
                  title={previewButtonState.title}
                  onClick={() => {
                    if (!previewButtonState.enabled || !previewButtonState.url) return;
                    const pid = (projectId ?? board.projectId).trim();
                    if (onOpenImplementationPreview) {
                      onOpenImplementationPreview({
                        mode: "integrated_app_preview",
                        url: previewButtonState.url,
                      });
                      return;
                    }
                    openActualIntegratedPreviewInNewWindow({
                      projectId: pid,
                      url: previewButtonState.url,
                    });
                  }}
                >
                  {previewButtonState.label}
                </button>
              ) : null}
            </div>
          </div>
          <IntegrationPreviewRemediationPanel
            pipelineStatus={integrationPipelineStatus}
            gitRepoUrl={targetRepository?.gitRepoUrl ?? executionSetup?.gitRepoUrl ?? null}
            onRetryIntegration={onRunIntegrationPipeline}
          />
        </section>
      ) : null}
    </section>
  );
}
