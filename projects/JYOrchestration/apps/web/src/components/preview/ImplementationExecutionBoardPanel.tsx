"use client";

import { useMemo, useState } from "react";
import {
  buildImplementationIntegratedPipelineLines,
  PER_TASK_PIPELINE_INTEGRATED_FOOTNOTE,
} from "@/lib/prototype/implementationTaskPipelinePolicy";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  buildCompactBoardSecondarySummaryLine,
  buildCompactBoardSummaryLine,
  buildImplementationExecutionBoardSummaryView,
  buildImplementationTaskTreeNodes,
  dedupeImplementationStageNextActions,
  partitionMobileBoardActions,
  resolveImplementationExecutionBoardSelectedTaskId,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import { deriveImplementationQuickRunStatus, type ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  deriveImplementationStageNextActions,
  type ImplementationStageNextActionsBoardInput,
} from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionClickInput } from "@/lib/prototype/implementationStageActionBinding";
import { ImplementationExecutionBoardTaskTree } from "@/components/preview/ImplementationExecutionBoardTaskTree";
import { ImplementationCodeAgentExecutionProgressCard } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import {
  buildCodeAgentExecutionProgressView,
  shouldHideBoardPrimaryCtaForProgress,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { isImplementationAutoQualityGateClientInFlight } from "@/lib/prototype/implementationAutoQualityGateClient";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
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
  effectiveImplementationState,
  boardInput,
  promptTimeline,
  onAction,
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
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly boardInput: ImplementationStageNextActionsBoardInput;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly onAction: (input: ImplementationStageActionClickInput) => void;
}) {
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

  const nextActions = useMemo(() => {
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: effectiveImplementationState.latestRun,
      workUnits: effectiveImplementationState.latestRun?.workUnits,
    });
    const status = deriveImplementationStageStatus(
      effectiveImplementationState,
      boardInput.executionState,
    );
    return dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        status,
        boardInput.executionState,
        prototypeSnapshot,
        {
          ...boardInput,
          implementationQuickRunV1,
          quickRunStatus,
        },
        {
          implementationSeedV1: effectiveImplementationState.implementationSeedV1,
          implementationTaskListV1: taskList,
        },
      ),
    );
  }, [
    effectiveImplementationState,
    boardInput,
    taskList,
    implementationQuickRunV1,
    quickRunStatus,
  ]);

  const actionPartition = useMemo(
    () => partitionMobileBoardActions(nextActions),
    [nextActions],
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

  const taskTreeNodes = useMemo(
    () => buildImplementationTaskTreeNodes({ board, activeTaskId }),
    [board, activeTaskId],
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

  const hidePrimaryCta = shouldHideBoardPrimaryCtaForProgress(
    codeAgentProgress.status,
    isImplementationAutoQualityGateClientInFlight(implementationAutoQualityGateV1),
  );

  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      <div className={styles.summaryCard}>
        <div className={styles.summaryPrimary}>{buildCompactBoardSummaryLine(board)}</div>
        <div className={`${styles.summarySecondary} ${styles.dashboardSecondaryLine}`}>
          {quickRunStatus === "preview_ready"
            ? "프로토타입 생성 완료 · Preview를 확인할 수 있습니다."
            : quickRunStatus === "blocked" || quickRunStatus === "failed"
              ? "자동실행이 중단되었습니다."
              : quickRunStatus === "running"
                ? "Quick 자동실행 진행 중"
                : buildCompactBoardSecondarySummaryLine({
                    board,
                    previewReady: summaryView.previewReady,
                    reviewReady: summaryView.testReadiness.ready,
                  })}
        </div>
      </div>

      <ImplementationCodeAgentExecutionProgressCard progress={codeAgentProgress} />

      <div className={styles.ctaRow}>
        {actionPartition.primary && !hidePrimaryCta ? (
          <button
            type="button"
            className={styles.ctaPrimary}
            data-testid="implementation-board-primary-cta"
            data-action-id={actionPartition.primary.actionId}
            data-action-label={actionPartition.primary.label}
            onClick={() =>
              onAction({
                actionId: actionPartition.primary!.actionId,
                label: actionPartition.primary!.label,
                source: "execution_board",
                buttonIndex: 0,
              })
            }
          >
            {actionPartition.primary.label}
          </button>
        ) : null}
        {actionPartition.more.length || actionPartition.secondary.length ? (
          <div className={styles.moreWrap}>
            <button
              type="button"
              className={styles.ctaSecondary}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              더보기
            </button>
            {moreOpen ? (
              <div className={styles.moreMenu} role="menu">
                {[...actionPartition.secondary, ...actionPartition.more].map((action, index) => (
                  <button
                    key={`${action.actionId}-${action.label}`}
                    type="button"
                    className={styles.moreItem}
                    role="menuitem"
                    data-action-id={action.actionId}
                    data-action-label={action.label}
                    onClick={() => {
                      setMoreOpen(false);
                      onAction({
                        actionId: action.actionId,
                        label: action.label,
                        source: "more_menu",
                        buttonIndex: index,
                      });
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className={styles.taskTreeSection} data-testid="implementation-task-tree-section">
        <div className={styles.taskTreeSectionTitle}>작업 트리 {board.taskRows.length}개</div>
        <ImplementationExecutionBoardTaskTree nodes={taskTreeNodes} />
      </section>

      {integratedPipelineLines.length ? (
        <section
          className={styles.taskTreeSection}
          data-testid="implementation-integrated-pipeline-section"
        >
          <div className={styles.taskTreeSectionTitle}>통합 단계 (전체 Task 완료 후)</div>
          <p className={styles.summarySecondary}>{PER_TASK_PIPELINE_INTEGRATED_FOOTNOTE}</p>
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
