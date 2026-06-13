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
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import { resolveStageTwoDeveloperPromptPreview } from "@/lib/prototype/resolveStageTwoDeveloperPromptPreview";
import { SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW } from "@/lib/prototype/implementationDeveloperPromptPreviewUi";
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
import { alignProductionCodeTaskIdsInRequirementsState } from "@/lib/prototype/requirementsStateProductionCodeTaskIdAlign";
import type { ImplementationRuntimeStateV1 } from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationStageNextActionsBoardInput } from "@/lib/prototype/implementationStageNextActions";
import { buildImplementationBoardExecutionContext } from "@/lib/prototype/implementationBoardExecutionContext";
import { ImplementationExecutionBoardIntegrationFooter } from "@/components/preview/ImplementationExecutionBoardIntegrationFooter";
import { ImplementationExecutionBoardRuntimeAdmin } from "@/components/preview/ImplementationExecutionBoardRuntimeAdmin";
import { ImplementationExecutionBoardDeveloperPromptPreview } from "@/components/preview/ImplementationExecutionBoardDeveloperPromptPreview";
import {
  normalizeCheckedCodeTaskIds,
  readBoardCheckedCodeTaskIds,
} from "@/lib/prototype/implementationBoardCheckedIds";
import { enrichCodeTaskRunForFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { deriveCodeTaskRunPhase } from "@/lib/prototype/codeTaskRunDerivedView";
import { resolveCursorSessionForRunPhase } from "@/lib/prototype/cursorSessionModel";
import {
  resolveCodeTaskStuckRecoveryHint,
  shouldShowCodeTaskStuckRecoveryPanel,
} from "@/lib/prototype/codeTaskStuckRecoveryUi";
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { CodeTaskManualGithubRecheckPayloadV1 } from "@/lib/prototype/codeTaskManualGithubRecheckPayload";
import { ImplementationExecutionBoardTaskTree } from "@/components/preview/ImplementationExecutionBoardTaskTree";
import { SampleDataArtifactsModal } from "@/components/preview/SampleDataArtifactsModal";
import { buildCodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  resolveCodeTaskTreeSelectAll,
  resolveCodeTaskTreeSelectAllToggleChecked,
  resolveCodeTaskTreeSelectionToggle,
  resolveParentTaskIdForCodeTask,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { summarizeCodeTaskBoardRowsFromTreeNodes } from "@/lib/prototype/implementationCodeTaskBoardState";
import {
  useImplementationBoardCheckedCodeTaskIds,
  useImplementationBoardCodeTaskSelectionSummary,
  usePruneNonSelectableCheckedCodeTaskIds,
} from "@/components/preview/useImplementationBoardCheckboxSelection";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import {
  applyControlPlaneIntegrationPipelineButtonGate,
  type ImplementationControlPlaneSnapshotV1,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import {
  resolveAutoGenerationReadyFromCapabilityJson,
} from "@/lib/prototype/autoGenerationSettingsState";
import { evaluateImplementationPreviewButtonState } from "@/lib/prototype/implementationPreviewButtonPolicy";
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
  onRecheckCodeTaskGithubVerify,
  githubRecheckBusyCodeTaskId,
  onRetryFailedCodeTask,
  projectId,
  implementationRuntimeStateV1,
  implementationRuntimeDbBundle,
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
  liveCheckedCodeTaskIdsRef,
  liveRunnableCodeTaskIdsRef,
  onCodeTaskSelectionSummaryChange,
  controlPlaneSnapshot,
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
  readonly onRecheckCodeTaskGithubVerify?: (input: {
    readonly codeTaskId: string;
    readonly rowPayload?: CodeTaskManualGithubRecheckPayloadV1 | null;
  }) => void;
  readonly githubRecheckBusyCodeTaskId?: string | null;
  readonly onRetryFailedCodeTask?: (codeTaskId: string) => void;
  readonly projectId?: string;
  readonly implementationRuntimeStateV1?: ImplementationRuntimeStateV1 | null;
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
  /** Parent toolbar quick-run reads latest checkbox selection (panel local state). */
  readonly liveCheckedCodeTaskIdsRef?: React.MutableRefObject<readonly string[] | null>;
  readonly liveRunnableCodeTaskIdsRef?: React.MutableRefObject<readonly string[] | null>;
  readonly onCodeTaskSelectionSummaryChange?: (
    summary: ReturnType<typeof summarizeCodeTaskBoardRowsFromTreeNodes>,
  ) => void;
  readonly controlPlaneSnapshot?: ImplementationControlPlaneSnapshotV1 | null;
}) {
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
  const [sampleDataArtifactsModal, setSampleDataArtifactsModal] = useState<{
    readonly codeTaskId: string;
    readonly title: string;
  } | null>(null);

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

  const boardSelectedCodeTaskIdsExplicit = useMemo(() => {
    if (!boardState) return undefined;
    return readBoardCheckedCodeTaskIds(boardState);
  }, [boardState]);

  const checkedFromBoard = useMemo(
    () =>
      normalizeCheckedCodeTaskIds({
        checkedCodeTaskIds: boardSelectedCodeTaskIdsExplicit,
        codeTaskPlan: implementationCodeTaskPlanV1,
        legacySelectedTaskIds: boardState?.selectedTaskIds,
      }),
    [boardSelectedCodeTaskIdsExplicit, boardState?.selectedTaskIds, implementationCodeTaskPlanV1],
  );

  const { checkedCodeTaskIds, commitCheckedCodeTaskIds } = useImplementationBoardCheckedCodeTaskIds({
    projectId: projectId ?? "",
    boardProjectId: board.projectId,
    checkedFromBoard,
    onSelectedCodeTaskIdsChange,
    liveCheckedCodeTaskIdsRef,
  });

  /** Integration/server snapshot — not used for checkbox or toolbar runnable gates (board rows SoT). */
  const codeTaskSummaryCounts = useMemo(
    () => {
      const summary = buildImplementationBoardExecutionContext({
        projectId,
        requirementsState: {
          implementationCodeTaskPlanV1: implementationCodeTaskPlanV1 ?? undefined,
          codeTaskExecutionRunsV1: codeTaskRuns,
          implementationExecutionBoardStateV1: boardState ?? undefined,
          implementationIntegrationStepsV1: implementationIntegrationStepsV1 ?? undefined,
          codeTaskIntegrationPlanV1: codeTaskIntegrationPlanV1 ?? undefined,
        },
        codeTaskPlan: implementationCodeTaskPlanV1,
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
    setSelectedTaskId((current) => current ?? activeTaskId);
  }, [activeTaskId]);

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

  const alignedCodeTaskOrchestration = useMemo(
    () =>
      alignProductionCodeTaskIdsInRequirementsState({
        requirementsState: {
          implementationCodeTaskPlanV1,
          codeTaskExecutionRunsV1,
          cursorWorkItemsV1,
        },
        taskList,
      }),
    [implementationCodeTaskPlanV1, codeTaskExecutionRunsV1, cursorWorkItemsV1, taskList],
  );

  const taskTreeNodes = useMemo(
    () =>
      buildImplementationTaskTreeNodes({
        board,
        codeTaskPlan: alignedCodeTaskOrchestration.codeTaskPlan,
        cursorWorkItems: alignedCodeTaskOrchestration.cursorWorkItems,
        codeTaskExecutionRuns: alignedCodeTaskOrchestration.runs ?? [],
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
        projectId: projectId ?? board.projectId,
        targetRepository,
      }),
    [
      board,
      alignedCodeTaskOrchestration,
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
      targetRepository,
      projectId,
      board.projectId,
    ],
  );

  const {
    codeTaskSelectionSummary,
    runnableCodeTaskIdsFromBoard,
    userSelectableCodeTaskIdsFromBoard,
    selectAllHeaderState,
  } = useImplementationBoardCodeTaskSelectionSummary({
    projectId: projectId ?? "",
    boardProjectId: board.projectId,
    checkedCodeTaskIds,
    taskTreeNodes,
    onCodeTaskSelectionSummaryChange,
    liveRunnableCodeTaskIdsRef,
  });

  usePruneNonSelectableCheckedCodeTaskIds({
    taskTreeNodes,
    checkedCodeTaskIds,
    commitCheckedCodeTaskIds,
  });

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

  const boardGateSelectionSummary =
    controlPlaneSnapshot?.board.selectionSummary ?? codeTaskSelectionSummary;

  const integrationButtonState = useMemo(
    () =>
      applyControlPlaneIntegrationPipelineButtonGate({
        runtimeButton: evaluateIntegrationPipelineButtonFromSnapshot(runtimeSnapshot, {
          autoGenerationReady,
          isIntegrationRunning: integrationPipelineBusy === true,
          latestPipelineStatus: integrationPipelineStatus,
          projectId: projectId ?? board.projectId,
          boardGateSummary: boardGateSelectionSummary,
        }),
        controlPlane: controlPlaneSnapshot ?? null,
      }),
    [
      runtimeSnapshot,
      autoGenerationReady,
      integrationPipelineBusy,
      integrationPipelineStatus,
      projectId,
      board.projectId,
      boardGateSelectionSummary,
      controlPlaneSnapshot,
    ],
  );

  const showIntegrationFooter =
    controlPlaneSnapshot?.boardFooter.showIntegrationPrepareButton ?? taskTreeNodes.length > 0;

  const showIntegrationButton = Boolean(onRunIntegrationPipeline);
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

  const showSummaryCard = showStuckRecovery;

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      {showSummaryCard ? (
        <div className={styles.summaryCard}>
          <ImplementationExecutionBoardRuntimeAdmin
            showStuckRecovery={showStuckRecovery}
            stuckRecoveryHint={stuckRecoveryHint}
            onRetryGithubVerify={onRetryGithubVerify}
            onRestartTask={onRestartTask}
            queueParentTaskId={queueParentTaskId}
            projectId={projectId}
            selectedCodeTaskId={selectedCodeTaskId}
            queueCurrentCodeTaskId={queueCurrentCodeTaskId}
          />
        </div>
      ) : null}

      <ImplementationExecutionBoardDeveloperPromptPreview
        codeTaskPlan={parsedCodeTaskPlan}
        executionTargetCodeTaskId={executionTargetCodeTaskId}
        stageTwoDeveloperPromptPreview={stageTwoDeveloperPromptPreview}
      />

      <section className={styles.taskTreeSection} data-testid="implementation-task-tree-section">
        <ImplementationExecutionBoardTaskTree
          nodes={taskTreeNodes}
          selectedCodeTaskId={selectedCodeTaskId}
          codeAgentProgress={codeAgentProgress}
          allChecked={selectAllHeaderState.allChecked}
          selectAllIndeterminate={selectAllHeaderState.indeterminate}
          selectedCodeTaskCount={codeTaskSelectionSummary.selectedRunnableCount}
          selectableCodeTaskCount={codeTaskSelectionSummary.runnableCount}
          integrationReadyCount={codeTaskSelectionSummary.integrationReadyCount}
          waitingCodeTaskIds={userSelectableCodeTaskIdsFromBoard}
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
            commitCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectionToggle({
                codeTaskId,
                checked,
                selectedCodeTaskIds: checkedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
                userSelectableCodeTaskIds: userSelectableCodeTaskIdsFromBoard,
              }),
            );
          }}
          onToggleSelectAll={(checked) => {
            const selectAll = resolveCodeTaskTreeSelectAllToggleChecked({
              header: selectAllHeaderState,
              nextInputChecked: checked,
            });
            commitCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectAll({
                selectAll,
                codeTaskPlan: implementationCodeTaskPlanV1,
                userSelectableCodeTaskIds: userSelectableCodeTaskIdsFromBoard,
              }),
            );
          }}
          onCopyCodeTaskCursorPrompt={onCopyCodeTaskCursorPrompt}
          onRecheckCodeTaskGithubVerify={onRecheckCodeTaskGithubVerify}
          githubRecheckBusyCodeTaskId={githubRecheckBusyCodeTaskId}
          onRetryFailedCodeTask={onRetryFailedCodeTask}
          onOpenSampleDataArtifacts={(input) => setSampleDataArtifactsModal(input)}
          onCopyDeveloperPromptsFromHeader={onCopyDeveloperPromptsFromHeader}
          developerPromptHeaderCopyDisabled={
            !executionTargetCodeTaskId && checkedCodeTaskIds.length === 0
          }
        />
      </section>

      <ImplementationExecutionBoardIntegrationFooter
        projectId={projectId ?? ""}
        boardProjectId={board.projectId}
        showIntegrationFooter={showIntegrationFooter}
        showIntegrationButton={showIntegrationButton}
        integrationButtonEnabled={integrationButtonEnabled}
        integrationButtonState={integrationButtonState}
        integrationPipelineBusy={integrationPipelineBusy}
        integrationSection={integrationSection}
        previewButtonState={previewButtonState}
        integrationPipelineStatus={integrationPipelineStatus}
        targetRepositoryGitRepoUrl={targetRepository?.gitRepoUrl}
        executionSetupGitRepoUrl={executionSetup?.gitRepoUrl}
        onRunIntegrationPipeline={onRunIntegrationPipeline}
        onMergeIntegrationPullRequest={onMergeIntegrationPullRequest}
        integrationMergeBusy={integrationMergeBusy}
        onOpenImplementationPreview={onOpenImplementationPreview}
      />

      {projectId?.trim() && sampleDataArtifactsModal ? (
        <SampleDataArtifactsModal
          open
          projectId={projectId.trim()}
          codeTaskId={sampleDataArtifactsModal.codeTaskId}
          codeTaskTitle={sampleDataArtifactsModal.title}
          onClose={() => setSampleDataArtifactsModal(null)}
        />
      ) : null}
    </section>
  );
}
