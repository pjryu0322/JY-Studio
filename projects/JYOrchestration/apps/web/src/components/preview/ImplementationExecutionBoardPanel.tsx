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
  formatCodeTaskExecutionQueueCompletionDetail,
  formatCodeTaskExecutionQueueSummary,
  summarizeCodeTaskExecutionQueueRuns,
} from "@/lib/prototype/codeTaskExecutionRunUi";
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
import { buildImplementationCodeTaskFeedbackSummary } from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import {
  buildImplementationCodeTaskReworkVm,
  formatCodeTaskReworkRecommendedActionKo,
} from "@/lib/prototype/implementationCodeTaskReworkVm";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { evaluateStageOnePromptPlanReadiness } from "@/lib/prototype/stageOnePromptReadiness";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import { SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW } from "@/lib/prototype/implementationDeveloperPromptPreviewUi";
import { resolveStageTwoDeveloperPromptPreview } from "@/lib/prototype/resolveStageTwoDeveloperPromptPreview";
import { summarizeBranchPlanForUi } from "@/lib/prototype/implementationBranchPlan";
import {
  formatStageOnePromptQualitySummaryLines,
  summarizeStageOnePromptQuality,
} from "@/lib/prototype/codeTaskStageOnePromptSections";
import type { CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { parseCodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  buildCompactBoardSecondarySummaryLine,
  buildImplementationExecutionBoardSummaryView,
  buildImplementationTaskTreeNodes,
  resolveImplementationExecutionBoardSelectedTaskId,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import { deriveImplementationQuickRunStatus, type ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  parseImplementationRuntimeStateV1,
  type ImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import type { ImplementationStageNextActionsBoardInput } from "@/lib/prototype/implementationStageNextActions";
import {
  buildImplementationExecutionOverview,
  resolveSelectedCodeTaskExecutionProgress,
} from "@/lib/prototype/implementationExecutionOverview";
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
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { formatImplementationRuntimeSnapshotSummaryLines } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  getCodeTaskDiagnosticPreviewOpenTarget,
  getIntegratedAppPreviewOpenTarget,
  getPreviewScopeViewUrl,
} from "@/lib/prototype/implementationPreviewOpenTarget";
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
  onCopyStageOnePlanningPrompt,
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
  onMergeIntegrationPullRequest,
  integrationMergeBusy,
  onRepairCodeTaskBranchPlan,
  branchPlanRepairBusy,
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
  readonly onCopyStageOnePlanningPrompt?: () => void;
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
  readonly onMergeIntegrationPullRequest?: () => void;
  readonly integrationMergeBusy?: boolean;
  readonly onRepairCodeTaskBranchPlan?: () => void;
  readonly branchPlanRepairBusy?: boolean;
}) {
  const feedbackSummary = useMemo(
    () => buildImplementationCodeTaskFeedbackSummary(codeTaskExecutionFeedbackV1),
    [codeTaskExecutionFeedbackV1],
  );
  const reworkVm = useMemo(
    () =>
      buildImplementationCodeTaskReworkVm({
        feedback: codeTaskExecutionFeedbackV1,
        codeTaskPlan: implementationCodeTaskPlanV1,
      }),
    [codeTaskExecutionFeedbackV1, implementationCodeTaskPlanV1],
  );
  const summaryView = useMemo(
    () =>
      buildImplementationExecutionBoardSummaryView({
        board,
        executionSetup,
        previewReady,
        hasExecutionState: true,
        boardState,
      }),
    [board, executionSetup, previewReady, boardState],
  );

  const parsedCodeTaskPlan = useMemo(
    () => parseImplementationCodeTaskPlanV1(implementationCodeTaskPlanV1) ?? null,
    [implementationCodeTaskPlanV1],
  );
  const branchPlanPanelLines = useMemo(
    () => summarizeBranchPlanForUi(parsedCodeTaskPlan?.implementationBranchPlanV1 ?? null),
    [parsedCodeTaskPlan],
  );
  const stageOneReadiness = useMemo(
    () => (parsedCodeTaskPlan ? evaluateStageOnePromptPlanReadiness({ plan: parsedCodeTaskPlan }) : null),
    [parsedCodeTaskPlan],
  );
  const needsBranchPlanRepair = Boolean(stageOneReadiness?.blocking);
  const stageOnePromptReady = Boolean(stageOneReadiness?.ready);
  const parsedPromptContextMap = useMemo(
    () => parseCodeTaskPromptContextMapV1(codeTaskPromptContextMapV1) ?? null,
    [codeTaskPromptContextMapV1],
  );
  const stageOneQualityLines = useMemo(() => {
    if (!parsedCodeTaskPlan || !stageOneReadiness) return [];
    const summary = summarizeStageOnePromptQuality({
      codeTaskPlan: parsedCodeTaskPlan,
      promptContextMap: parsedPromptContextMap,
    });
    const lines = formatStageOnePromptQualitySummaryLines(summary);
    const total = parsedCodeTaskPlan.tasks.length;
    const header = stageOnePromptReady
      ? ["CodeTask 1단계 프롬프트 준비 완료", ""]
      : [
          "CodeTask 1단계 프롬프트가 아직 실행 준비 상태가 아닙니다.",
          "",
          `- Branch Plan 생성: ${stageOneReadiness.branchPlanCount}/${total}`,
          `- File Boundary 생성: ${stageOneReadiness.fileBoundaryCount}/${total}`,
          `- ready CodeTask: ${stageOneReadiness.readyCodeTaskCount}/${total}`,
          `- missing: ${summary.warningExamples.length ? stageOneReadiness.diagnostics.length : 0}`,
          "",
        ];
    return [...header, ...lines];
  }, [parsedCodeTaskPlan, parsedPromptContextMap, stageOneReadiness, stageOnePromptReady]);

  const quickRunStatus = useMemo(
    () =>
      deriveImplementationQuickRunStatus({
        quickRun: implementationQuickRunV1,
        board,
        taskCursorExecution: taskCursorExecutionV1,
        autoGate: implementationAutoQualityGateV1,
        previewReady,
      }),
    [implementationQuickRunV1, board, taskCursorExecutionV1, implementationAutoQualityGateV1, previewReady],
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
    ],
  );

  const runtimeSnapshot = codeTaskSummaryCounts.runtimeSnapshot;

  const executionUnitDebugLines = useMemo(
    () =>
      codeTaskSummaryCounts.executionUnits
        .filter((u) => u.status === "running" || u.status === "verifying" || u.status === "ready")
        .slice(0, 4)
        .map(
          (u) =>
            `${u.codeTaskId} · ${u.status} · ${u.workBranch || "-"} · head ${String(u.beforeHeadSha ?? "-").slice(0, 8)}→${String(u.afterHeadSha ?? "-").slice(0, 8)}`,
        ),
    [codeTaskSummaryCounts.executionUnits],
  );

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

  const executionOverview = useMemo(
    () =>
      buildImplementationExecutionOverview({
        board,
        codeTaskPlan: implementationCodeTaskPlanV1,
        activeTaskId,
        activeCodeTaskTitle:
          implementationCodeTaskPlanV1?.tasks.find((t) => t.codeTaskId === selectedCodeTaskId)?.title ??
          board.taskRows.find((row) => row.taskId === activeTaskId)?.title,
        runtime: parseImplementationRuntimeStateV1(implementationRuntimeStateV1),
        dbRuntimeState: implementationRuntimeDbBundle?.currentRun?.runtimeState ?? null,
        activeCodeTaskRun,
        activeFlowPhase,
        selectedCodeTaskIds: displaySelectedCodeTaskIds,
        codeTaskRuns,
      }),
    [
      board,
      implementationCodeTaskPlanV1,
      activeTaskId,
      selectedCodeTaskId,
      implementationRuntimeStateV1,
      implementationRuntimeDbBundle,
      activeCodeTaskRun,
      activeFlowPhase,
      displaySelectedCodeTaskIds,
      codeTaskRuns,
    ],
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

  const allCodeTasksChecked = useMemo(
    () =>
      isCodeTaskTreeFullySelected({
        selectedCodeTaskIds: checkedCodeTaskIds,
        codeTaskPlan: implementationCodeTaskPlanV1,
        visibleCodeTaskIds: taskTreeNodes.map((node) => node.codeTaskId),
      }),
    [checkedCodeTaskIds, implementationCodeTaskPlanV1, taskTreeNodes],
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
    ],
  );

  const codetasksCompletedIntegrationHint = useMemo(() => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(runtimeSnapshot);
    if (button.enabled && button.userStatusLines.length) {
      return button.userStatusLines.join("\n");
    }
    return null;
  }, [runtimeSnapshot]);

  const integrationPipelineDisplayLines = useMemo(() => {
    const lines = [...integrationSection.pipelineLines];
    if (integrationSection.integratedAppPreviewReady && parsedPreviewRuntime?.status === "ready") {
      lines.push({ stepId: "preview_ready", label: "Preview 준비", statusLabel: "완료" });
    } else if (integrationSection.codeTaskPreviewReady && parsedPreviewRuntime?.status === "ready") {
      lines.push({ stepId: "preview_ready", label: "CodeTask Preview", statusLabel: "진단용" });
    } else if (parsedPreviewRuntime?.status === "failed") {
      lines.push({ stepId: "preview_ready", label: "Preview 준비", statusLabel: "실패" });
    }
    return lines;
  }, [integrationSection.pipelineLines, parsedPreviewRuntime?.status]);

  const integrationButtonState = useMemo(
    () => evaluateIntegrationPipelineButtonFromSnapshot(runtimeSnapshot),
    [runtimeSnapshot],
  );

  const showIntegrationButton = integrationButtonState.show;
  const integrationButtonEnabled = integrationButtonState.enabled;

  const codeTaskDiagnosticPreviewTarget = useMemo(
    () =>
      getCodeTaskDiagnosticPreviewOpenTarget({
        runtime: parsedPreviewRuntime,
        codeTaskPreviewReady: integrationSection.codeTaskPreviewReady,
      }),
    [parsedPreviewRuntime, integrationSection.codeTaskPreviewReady],
  );

  const integratedAppPreviewTarget = useMemo(
    () =>
      getIntegratedAppPreviewOpenTarget({
        runtime: parsedPreviewRuntime,
        integratedAppPreviewReady: integrationSection.integratedAppPreviewReady,
      }),
    [parsedPreviewRuntime, integrationSection.integratedAppPreviewReady],
  );

  const previewScopeViewUrl = useMemo(
    () => getPreviewScopeViewUrl(parsedPreviewRuntime),
    [parsedPreviewRuntime],
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
  const [stageOneDiagnosticsOpen, setStageOneDiagnosticsOpen] = useState(false);

  const selectedExecutionProgress = useMemo(
    () =>
      resolveSelectedCodeTaskExecutionProgress({
        selectedCodeTaskIds: displaySelectedCodeTaskIds,
        queue: codeTaskQueue,
        runs: codeTaskRuns,
      }),
    [displaySelectedCodeTaskIds, codeTaskQueue, codeTaskRuns],
  );

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

  const queueSummaryLine = useMemo(() => {
    if (!codeTaskQueue || codeTaskQueue.status === "idle") return null;
    const sequenceIds =
      displaySelectedCodeTaskIds.length > 0
        ? displaySelectedCodeTaskIds
        : codeTaskQueue.selectedCodeTaskIds;
    const runSummary = summarizeCodeTaskExecutionQueueRuns({
      runs: codeTaskRuns,
      selectedCodeTaskIds: sequenceIds,
    });
    if (
      codeTaskQueue.status === "completed" ||
      codeTaskQueue.status === "completed_with_issues" ||
      codeTaskQueue.status === "failed"
    ) {
      return formatCodeTaskExecutionQueueCompletionDetail({
        runSummary,
        codeTaskPlan: implementationCodeTaskPlanV1,
        runs: codeTaskRuns,
        selectedCodeTaskIds: sequenceIds,
      });
    }
    const total =
      selectedExecutionProgress?.total ??
      sequenceIds.length ??
      codeTaskQueue.selectedCodeTaskIds.length;
    const currentIndex =
      selectedExecutionProgress != null
        ? Math.max(0, selectedExecutionProgress.done - 1)
        : codeTaskQueue.currentIndex;
    return formatCodeTaskExecutionQueueSummary({
      currentIndex,
      total,
      status: codeTaskQueue.status,
      runSummary,
    });
  }, [
    displaySelectedCodeTaskIds,
    codeTaskRuns,
    codeTaskQueue,
    implementationCodeTaskPlanV1,
    selectedExecutionProgress,
  ]);

  const selectedCompletedCount = useMemo(() => {
    if (codeTaskSummaryCounts.selectedCodeTaskCount > 0) {
      return codeTaskSummaryCounts.completedCodeTaskCount;
    }
    const sequenceIds =
      displaySelectedCodeTaskIds.length > 0
        ? displaySelectedCodeTaskIds
        : codeTaskQueue?.selectedCodeTaskIds ?? [];
    if (!sequenceIds.length) return 0;
    const summary = summarizeCodeTaskExecutionQueueRuns({
      runs: codeTaskRuns,
      selectedCodeTaskIds: sequenceIds,
    });
    return summary.completed + summary.noCodeChange;
  }, [
    codeTaskSummaryCounts.selectedCodeTaskCount,
    codeTaskSummaryCounts.completedCodeTaskCount,
    displaySelectedCodeTaskIds,
    codeTaskQueue?.selectedCodeTaskIds,
    codeTaskRuns,
  ]);

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      <div className={styles.summaryCard} data-testid="implementation-execution-overview-card">
        <div className={styles.overviewCard}>
          <div className={styles.overviewCardTitle}>
            {executionOverview.headerTitle}
          </div>
          {executionUnitDebugLines.length > 0 ? (
            <div className={styles.overviewCardLines} data-testid="execution-unit-debug-lines">
              {executionUnitDebugLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}
          <ul className={styles.overviewCardLines}>
            {[
              ...formatImplementationRuntimeSnapshotSummaryLines(runtimeSnapshot),
              ...(executionOverview.flowPhaseLabel || executionOverview.runtimeStateLabel
                ? [`상태: ${executionOverview.flowPhaseLabel ?? executionOverview.runtimeStateLabel}`]
                : []),
              ...(codetasksCompletedIntegrationHint ? [codetasksCompletedIntegrationHint] : []),
            ].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className={`${styles.summarySecondary} ${styles.dashboardSecondaryLine}`}>
          {quickRunStatus === "preview_ready"
            ? "프로토타입 생성 완료 · Preview를 확인할 수 있습니다."
            : quickRunStatus === "blocked" || quickRunStatus === "failed"
              ? "자동실행이 중단되었습니다."
              : quickRunStatus === "running"
                ? queueSummaryLine ?? "선택 CodeTask 순차 실행 중"
                : buildCompactBoardSecondarySummaryLine({
                    board,
                    previewReady: summaryView.previewReady,
                    reviewReady: summaryView.testReadiness.ready,
                    feedbackSummary,
                    reworkVm,
                  })}
        </div>
        {queueSummaryLine ? (
          <div className={styles.queueSummaryBanner} data-testid="code-task-execution-queue-summary">
            {queueSummaryLine}
          </div>
        ) : null}
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

      {parsedCodeTaskPlan ? (
        <section className={styles.taskTreeSection} data-testid="implementation-branch-plan-section">
          <div className={styles.integrationSectionHeader}>
            <strong>Branch Plan</strong>
            {needsBranchPlanRepair && onRepairCodeTaskBranchPlan ? (
              <button
                type="button"
                className={styles.githubVerifyRetryLink}
                data-testid="implementation-branch-plan-repair-button"
                disabled={branchPlanRepairBusy === true}
                onClick={() => onRepairCodeTaskBranchPlan()}
              >
                {branchPlanRepairBusy ? "보정 중…" : "Branch Plan/File Boundary 보정"}
              </button>
            ) : null}
          </div>
          {branchPlanPanelLines.map((line) => (
            <div key={line} className={styles.summarySecondary}>
              {line}
            </div>
          ))}
          {stageOneQualityLines.length ? (
            <div className={styles.summarySecondary} data-testid="code-task-stage-one-diagnostics">
              <button
                type="button"
                className={styles.reworkToggle}
                aria-expanded={stageOneDiagnosticsOpen}
                data-testid="implementation-stage-one-diagnostics-toggle"
                onClick={() => setStageOneDiagnosticsOpen((open) => !open)}
              >
                {stageOneDiagnosticsOpen
                  ? "CodeTask 1단계 계획 보기 (진단/검토용) 닫기"
                  : "CodeTask 1단계 계획 보기 (진단/검토용) 펼치기"}
              </button>
              {stageOneDiagnosticsOpen ? (
                <>
                  <p className={styles.summarySecondary} style={{ marginTop: 8 }}>
                    이 프롬프트는 전체 CodeTask 계획/진단용입니다. Cursor 실행용이 아닙니다. Cursor
                    실행에는 각 CodeTask의 2단계 개발 프롬프트를 사용합니다.
                  </p>
                  {stageOneQualityLines.map((line, index) => (
                    <div key={`stage-one-quality-${index}`}>{line}</div>
                  ))}
                  <button
                    type="button"
                    className={styles.githubVerifyRetryLink}
                    data-testid="implementation-copy-stage-one-planning-prompt"
                    disabled={!onCopyStageOnePlanningPrompt}
                    onClick={() => onCopyStageOnePlanningPrompt?.()}
                  >
                    계획 프롬프트 복사
                  </button>
                </>
              ) : null}
            </div>
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
              }),
            );
          }}
          onToggleSelectAll={(checked) => {
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectAll({
                selectAll: checked,
                codeTaskPlan: implementationCodeTaskPlanV1,
                visibleCodeTaskIds: taskTreeNodes.map((node) => node.codeTaskId),
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

      {integrationSection.showSection ? (
        <section
          className={styles.taskTreeSection}
          data-testid="implementation-integrated-pipeline-section"
        >
          <div className={styles.integrationSectionHeader}>
            <div className={styles.taskTreeSectionTitle}>통합 단계 · 완료된 CodeTask 기준</div>
            <div className={styles.integrationSectionActions}>
              {showIntegrationButton && onRunIntegrationPipeline ? (
                <button
                  type="button"
                  className={styles.integrationPrimaryButton}
                  data-testid="implementation-integration-run-button"
                  disabled={integrationPipelineBusy === true || !integrationButtonEnabled}
                  aria-disabled={integrationPipelineBusy === true || !integrationButtonEnabled}
                  onClick={onRunIntegrationPipeline}
                >
                  {integrationPipelineBusy
                    ? integrationButtonState.buttonLabel === "Preview 준비 계속"
                      ? "Preview 준비 계속 중…"
                      : integrationButtonState.continueBuildPreview
                        ? "Build 검증 및 Preview 준비 계속 중…"
                        : "통합 branch 생성 및 Preview 준비 중…"
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
              {integrationSection.codeTaskPreviewReady &&
              codeTaskDiagnosticPreviewTarget.url ? (
                <button
                  type="button"
                  className={styles.integrationPreviewScopeButton}
                  data-testid="implementation-codetask-diagnostic-preview-open-button"
                  onClick={() => {
                    window.open(
                      codeTaskDiagnosticPreviewTarget.url!,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  {codeTaskDiagnosticPreviewTarget.label}
                </button>
              ) : null}
              {integrationSection.integratedAppPreviewReady &&
              integratedAppPreviewTarget.url ? (
                <button
                  type="button"
                  className={styles.integrationPreviewButton}
                  data-testid="implementation-integrated-app-preview-open-button"
                  onClick={() => {
                    window.open(integratedAppPreviewTarget.url!, "_blank", "noopener,noreferrer");
                  }}
                >
                  {integratedAppPreviewTarget.label}
                </button>
              ) : null}
              {integrationSection.codeTaskPreviewReady &&
              previewScopeViewUrl ? (
                <button
                  type="button"
                  className={styles.integrationPreviewScopeButton}
                  data-testid="implementation-integration-preview-scope-button"
                  onClick={() => {
                    window.open(previewScopeViewUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Preview 범위 보기
                </button>
              ) : null}
            </div>
          </div>
          <div className={styles.taskTreeList}>
            {showIntegrationButton && integrationButtonState.userStatusLines.length
              ? integrationButtonState.userStatusLines.map((line, index) => (
                  <div
                    key={`integration-button-status-${index}`}
                    className={styles.taskTreeChildLine}
                    data-testid={
                      index === 0
                        ? integrationButtonEnabled
                          ? "implementation-integration-enabled-hint"
                          : "implementation-integration-disabled-reason"
                        : undefined
                    }
                  >
                    {line}
                  </div>
                ))
              : null}
            {integrationSection.previewStatusLines.map((line) => (
              <div key={line} className={styles.taskTreeChildLine}>
                {line}
              </div>
            ))}
            {integrationSection.summaryLines.map((line) => (
              <div key={line} className={styles.taskTreeChildLine}>
                {line}
              </div>
            ))}
            {integrationSection.integrationPlanLines.map((line) => (
              <div key={line} className={styles.taskTreeChildLine}>
                {line}
              </div>
            ))}
            {integrationSection.preIntegrationPreviewLine ? (
              <div className={styles.taskTreeChildLine}>
                {integrationSection.preIntegrationPreviewLine}
              </div>
            ) : null}
            {integrationSection.integratedAppPreviewReady && integratedAppPreviewTarget.hint ? (
              <div className={styles.taskTreeChildLine}>{integratedAppPreviewTarget.hint}</div>
            ) : null}
            {integrationSection.codeTaskPreviewReady && codeTaskDiagnosticPreviewTarget.hint ? (
              <div className={styles.taskTreeChildLine}>{codeTaskDiagnosticPreviewTarget.hint}</div>
            ) : null}
            {!integrationSection.integratedAppPreviewReady &&
            integratedAppPreviewTarget.hint &&
            integratedAppPreviewTarget.hint !== integrationSection.preIntegrationPreviewLine ? (
              <div className={styles.taskTreeChildLine}>{integratedAppPreviewTarget.hint}</div>
            ) : null}
            {integrationSection.scopeDetailLines.map((line, index) => (
              <div key={`scope-${index}-${line}`} className={styles.taskTreeChildLine}>
                {line}
              </div>
            ))}
            {integrationPipelineDisplayLines.map((line) => (
              <div key={line.stepId} className={styles.taskTreeChildLine}>
                {line.label}: {line.statusLabel}
              </div>
            ))}
            {integrationSection.includedPreviewRows.length || integrationSection.excludedPreviewRows.length ? (
              <details className={styles.integrationPreviewDetails}>
                <summary>포함/제외 CodeTask 상세</summary>
                <div className={styles.integrationPreviewDetailsBody}>
                  {integrationSection.includedPreviewRows.map((row) => (
                    <div key={row.codeTaskId}>포함 · {row.title}</div>
                  ))}
                  {integrationSection.excludedPreviewRows.map((row) => (
                    <div key={row.codeTaskId}>제외 · {row.label}</div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
