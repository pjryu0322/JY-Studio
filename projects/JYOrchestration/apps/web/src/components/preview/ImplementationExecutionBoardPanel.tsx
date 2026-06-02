"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
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
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import { buildImplementationCodeTaskFeedbackSummary } from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import {
  buildImplementationCodeTaskReworkVm,
  formatCodeTaskReworkRecommendedActionKo,
} from "@/lib/prototype/implementationCodeTaskReworkVm";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
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
  formatImplementationExecutionOverviewLines,
} from "@/lib/prototype/implementationExecutionOverview";
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
  resolveProcessTaskCodeTaskSelectionToggle,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
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
  onCancelTaskCursorPolling,
  onResumeTaskCursorStatusCheck,
  onRestartTask,
  onSelectedTaskIdsChange,
  onSelectedCodeTaskIdsChange,
  onRunSingleCodeTask,
  onForceReleaseExecution,
  onRedispatchRuntime,
  onShowRuntimeDiagnostics,
  implementationRuntimeStateV1,
  codeTaskExecutionFeedbackV1,
  implementationCodeTaskPlanV1,
  cursorWorkItemsV1,
  codeTaskExecutionQueueV1,
  codeTaskExecutionRunsV1,
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
  readonly onCancelTaskCursorPolling?: () => void;
  readonly onResumeTaskCursorStatusCheck?: () => void;
  readonly onRestartTask?: (taskId: string) => void;
  readonly onSelectedTaskIdsChange?: (selectedTaskIds: readonly string[]) => void;
  readonly onSelectedCodeTaskIdsChange?: (selectedCodeTaskIds: readonly string[]) => void;
  readonly onRunSingleCodeTask?: (codeTaskId: string) => void;
  readonly onForceReleaseExecution?: () => void;
  readonly onRedispatchRuntime?: () => void;
  readonly onShowRuntimeDiagnostics?: () => void;
  readonly implementationRuntimeStateV1?: ImplementationRuntimeStateV1 | null;
  readonly codeTaskExecutionFeedbackV1?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly codeTaskExecutionQueueV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
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

  const activeTaskId = useMemo(
    () =>
      resolveImplementationExecutionBoardSelectedTaskId({
        board,
        codeAgentWipExecutionV1,
        taskCursorExecutionV1,
      }),
    [board, codeAgentWipExecutionV1, taskCursorExecutionV1],
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(activeTaskId);
  const [selectedCodeTaskId, setSelectedCodeTaskId] = useState<string | null>(null);
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
  const allCodeTasksChecked = useMemo(
    () =>
      isCodeTaskTreeFullySelected({
        selectedCodeTaskIds: checkedCodeTaskIds,
        codeTaskPlan: implementationCodeTaskPlanV1,
      }),
    [checkedCodeTaskIds, implementationCodeTaskPlanV1],
  );

  useEffect(() => {
    setSelectedTaskId((current) => current ?? activeTaskId);
  }, [activeTaskId]);

  const updateCheckedCodeTaskIds = (nextSelectedCodeTaskIds: readonly string[]) => {
    onSelectedCodeTaskIdsChange?.(nextSelectedCodeTaskIds);
  };

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
      }),
    [board, implementationCodeTaskPlanV1, activeTaskId, selectedCodeTaskId, implementationRuntimeStateV1],
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
        checkedCodeTaskIds,
        taskCursorExecution: taskCursorExecutionV1 ?? null,
        implementationAutoQualityGateV1,
        promptTimeline,
        serverJob: activeTaskCursorJob ?? null,
      }),
    [
      board,
      implementationCodeTaskPlanV1,
      cursorWorkItemsV1,
      codeTaskExecutionRunsV1,
      activeTaskId,
      selectedTaskId,
      selectedCodeTaskId,
      checkedCodeTaskIds,
      taskCursorExecutionV1,
      implementationAutoQualityGateV1,
      promptTimeline,
      activeTaskCursorJob,
    ],
  );

  const integratedPipelineLines = useMemo(
    () => buildImplementationIntegratedPipelineLines(board.integratedRows),
    [board.integratedRows],
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

  const codeTaskQueue = useMemo(
    () => parseCodeTaskExecutionQueueV1(codeTaskExecutionQueueV1) ?? null,
    [codeTaskExecutionQueueV1],
  );

  const queueSummaryLine = useMemo(() => {
    if (!codeTaskQueue || codeTaskQueue.status === "idle") return null;
    const runs = parseCodeTaskExecutionRunsV1(codeTaskExecutionRunsV1) ?? [];
    const runSummary = summarizeCodeTaskExecutionQueueRuns({
      runs,
      selectedCodeTaskIds: codeTaskQueue.selectedCodeTaskIds,
    });
    if (
      codeTaskQueue.status === "completed" ||
      codeTaskQueue.status === "completed_with_issues" ||
      codeTaskQueue.status === "failed"
    ) {
      return formatCodeTaskExecutionQueueCompletionDetail({
        runSummary,
        codeTaskPlan: implementationCodeTaskPlanV1,
        runs,
        selectedCodeTaskIds: codeTaskQueue.selectedCodeTaskIds,
      });
    }
    return formatCodeTaskExecutionQueueSummary({
      currentIndex: codeTaskQueue.currentIndex,
      total: codeTaskQueue.selectedCodeTaskIds.length,
      status: codeTaskQueue.status,
      runSummary,
    });
  }, [codeTaskExecutionRunsV1, codeTaskQueue, implementationCodeTaskPlanV1]);

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      <div className={styles.summaryCard} data-testid="implementation-execution-overview-card">
        <div className={styles.overviewCard}>
          <div className={styles.overviewCardTitle}>
            {executionOverview.isRunning ? "구현 실행 중" : "구현 실행 대기"}
          </div>
          <ul className={styles.overviewCardLines}>
            {formatImplementationExecutionOverviewLines(executionOverview, {
              selectedCodeTaskCount: checkedCodeTaskIds.length,
            }).map((line) => (
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
        {executionOverview.isRunning ? (
          <div className={styles.runtimeAdminActions}>
            {onShowRuntimeDiagnostics ? (
              <button
                type="button"
                className={styles.runtimeDiagnosticsButton}
                data-testid="implementation-runtime-diagnostics"
                onClick={onShowRuntimeDiagnostics}
              >
                Runtime 상태 보기
              </button>
            ) : null}
            {onRedispatchRuntime ? (
              <button
                type="button"
                className={styles.runtimeRedispatchButton}
                data-testid="implementation-runtime-redispatch"
                onClick={onRedispatchRuntime}
              >
                재디스패치
              </button>
            ) : null}
            {onForceReleaseExecution ? (
              <button
                type="button"
                className={styles.forceReleaseButton}
                data-testid="implementation-force-release-execution"
                onClick={onForceReleaseExecution}
              >
                실행 잠금 해제
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

      <section className={styles.taskTreeSection} data-testid="implementation-task-tree-section">
        <ImplementationExecutionBoardTaskTree
          nodes={taskTreeNodes}
          selectedTaskId={selectedTaskId}
          selectedCodeTaskId={selectedCodeTaskId}
          codeAgentProgress={codeAgentProgress}
          onCancelTaskCursorPolling={onCancelTaskCursorPolling}
          allChecked={allCodeTasksChecked}
          selectedCodeTaskCount={checkedCodeTaskIds.length}
          onSelectTask={(taskId) => {
            setSelectedTaskId(taskId);
            updateCheckedCodeTaskIds(
              resolveProcessTaskCodeTaskSelectionToggle({
                parentTaskId: taskId,
                checked: true,
                selectedCodeTaskIds: checkedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
              }),
            );
          }}
          onSelectCodeTask={(_parentTaskId, codeTaskId) => {
            setSelectedCodeTaskId(codeTaskId);
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectionToggle({
                codeTaskId,
                checked: true,
                selectedCodeTaskIds: checkedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
              }),
            );
          }}
          onToggleTaskChecked={(taskId, checked) => {
            updateCheckedCodeTaskIds(
              resolveProcessTaskCodeTaskSelectionToggle({
                parentTaskId: taskId,
                checked,
                selectedCodeTaskIds: checkedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
              }),
            );
          }}
          onToggleCodeTaskChecked={(codeTaskId, checked) => {
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectionToggle({
                codeTaskId,
                checked,
                selectedCodeTaskIds: checkedCodeTaskIds,
                codeTaskPlan: implementationCodeTaskPlanV1,
              }),
            );
          }}
          onToggleSelectAll={(checked) => {
            updateCheckedCodeTaskIds(
              resolveCodeTaskTreeSelectAll({
                selectAll: checked,
                codeTaskPlan: implementationCodeTaskPlanV1,
              }),
            );
          }}
          onRunSingleCodeTask={onRunSingleCodeTask}
          onRestartTask={onRestartTask}
          onStopTask={() => onCancelTaskCursorPolling?.()}
          onResumeStatusCheck={() => onResumeTaskCursorStatusCheck?.()}
        />
      </section>

      {integratedPipelineLines.length ? (
        <section
          className={styles.taskTreeSection}
          data-testid="implementation-integrated-pipeline-section"
        >
          <div className={styles.taskTreeSectionTitle}>통합 단계 (전체 Task 완료 후)</div>
          <div className={styles.taskTreeList}>
            {integratedPipelineLines.map((line) => (
              <div key={line.stepId} className={styles.taskTreeChildLine}>
                {line.label}: {line.statusLabel}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
