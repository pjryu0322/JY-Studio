"use client";

import { useMemo, useState } from "react";
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
  buildMobileBoardEnvPills,
  countIntegratedStepsCompleted,
  dedupeImplementationStageNextActions,
  formatImplementationBoardStepStatusKo,
  partitionMobileBoardActions,
  resolveNextTaskCardView,
  shouldEmphasizeIntegratedStep,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import { formatTaskCursorSetupReadinessPillValue } from "@/lib/prototype/implementationBoardEnvDetailView";
import {
  deriveImplementationStageNextActions,
  type ImplementationStageNextActionsBoardInput,
} from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionClickInput } from "@/lib/prototype/implementationStageActionBinding";
import {
  ImplementationExecutionBoardCardList,
  ImplementationExecutionBoardIntegratedTable,
  ImplementationExecutionBoardTable,
} from "@/components/preview/ImplementationExecutionBoardTable";
import { ImplementationExecutionBoardDetail } from "@/components/preview/ImplementationExecutionBoardDetail";
import { ImplementationCodeAgentExecutionProgressCard } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import {
  buildCodeAgentExecutionProgressView,
  shouldHideBoardPrimaryCtaForProgress,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { isImplementationAutoQualityGateClientInFlight } from "@/lib/prototype/implementationAutoQualityGateClient";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function pillClass(tone: "ok" | "warn" | "muted"): string {
  if (tone === "ok") return `${styles.pill} ${styles.pillOk}`;
  if (tone === "warn") return `${styles.pill} ${styles.pillWarn}`;
  return `${styles.pill} ${styles.pillMuted}`;
}

export function ImplementationExecutionBoardPanel({
  board,
  taskList,
  executionSetup,
  codeAgentWipExecutionV1,
  taskCursorExecutionV1,
  taskCursorExecutionHistoryV1,
  implementationAutoQualityGateV1,
  boardState,
  previewReady,
  effectiveImplementationState,
  boardInput,
  promptTimeline,
  onAction,
  onOpenEnvSettings,
}: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskList: ImplementationTaskListV1;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly previewReady?: boolean;
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly boardInput: ImplementationStageNextActionsBoardInput;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly onAction: (input: ImplementationStageActionClickInput) => void;
  readonly onOpenEnvSettings?: () => void;
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

  const mobileEnvPills = useMemo(
    () => buildMobileBoardEnvPills({ executionSetup }),
    [executionSetup],
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
        boardInput,
        {
          implementationSeedV1: effectiveImplementationState.implementationSeedV1,
          implementationTaskListV1: taskList,
        },
      ),
    );
  }, [effectiveImplementationState, boardInput, taskList]);

  const actionPartition = useMemo(
    () => partitionMobileBoardActions(nextActions),
    [nextActions],
  );

  const nextTask = useMemo(
    () => resolveNextTaskCardView({ board, codeAgentWipExecutionV1 }),
    [board, codeAgentWipExecutionV1],
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

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const detailRow = useMemo(
    () => board.taskRows.find((row) => row.taskId === detailTaskId) ?? null,
    [board.taskRows, detailTaskId],
  );

  const integratedCompleted = countIntegratedStepsCompleted(board.integratedRows);
  const integratedTotal = board.integratedRows.length;

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-panel"
      aria-label="구현 Execution Board"
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>구현 단계</div>
        <div className={styles.pillRow}>
          {mobileEnvPills.map((pill) => (
            <span key={pill.label} className={pillClass(pill.tone)}>
              {pill.label}: {pill.value}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryPrimary}>{buildCompactBoardSummaryLine(board)}</div>
        <div className={styles.summarySecondary}>
          {buildCompactBoardSecondarySummaryLine({
            board,
            previewReady: summaryView.previewReady,
            reviewReady: summaryView.testReadiness.ready,
          })}
        </div>
      </div>

      <div className={styles.desktopSummaryGrid}>
        {[
          ["전체", board.summary.totalTasks],
          ["완료", board.summary.completedTasks],
          ["진행 중", board.summary.inProgressTasks],
          ["실패", board.summary.failedTasks],
          ["Preview", summaryView.previewReady ? "준비됨" : "미준비"],
          ["검토단계", summaryView.testReadiness.ready ? "이동 가능" : "불가"],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{value}</div>
          </div>
        ))}
      </div>

      {nextTask ? (
        <div className={styles.nextTaskCard} data-testid="implementation-next-task-card">
          <div className={styles.nextTaskLabel}>다음 작업</div>
          <div className={styles.nextTaskId}>{nextTask.taskId}</div>
          <div className={styles.nextTaskTitle}>{nextTask.title}</div>
          <div className={`${styles.nextTaskMeta} ${styles.nextTaskMetaCompact}`}>
            {nextTask.developerStatusLabel} · {nextTask.priority}
            <span className={styles.nextTaskMetaDetail}>
              <br />
              선정 사유: {nextTask.selectionReason}
              {nextTask.dependencies.length ? (
                <>
                  <br />
                  선행 의존성: {nextTask.dependencies.join(", ")}
                </>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}

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
        {actionPartition.secondary.map((action, index) => (
          <button
            key={`${action.actionId}-${action.label}`}
            type="button"
            className={styles.ctaSecondary}
            data-action-id={action.actionId}
            data-action-label={action.label}
            onClick={() =>
              onAction({
                actionId: action.actionId,
                label: action.label,
                source: "execution_board",
                buttonIndex: index + 1,
              })
            }
          >
            {action.label}
          </button>
        ))}
        {actionPartition.more.length ? (
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
                {actionPartition.more.map((action, index) => (
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

      <details className={styles.disclosure} data-testid="implementation-task-list-disclosure">
        <summary className={styles.disclosureSummary} aria-expanded={false}>
          작업목록 {board.taskRows.length}개 · 보기
        </summary>
        <div className={styles.disclosureBody}>
          <p className={styles.taskListHint}>1~{board.taskRows.length}개 작업 · 아래로 스크롤하여 더 보기</p>
          <div className={styles.taskListScrollArea} data-testid="implementation-task-list-scroll-area">
            <div className={styles.mobileCardList}>
              <ImplementationExecutionBoardCardList
                board={board}
                selectedTaskId={detailTaskId}
                codeAgentWipExecutionV1={codeAgentWipExecutionV1}
                taskCursorExecutionV1={taskCursorExecutionV1}
                taskCursorExecutionHistoryV1={taskCursorExecutionHistoryV1}
                codeAgentProgress={codeAgentProgress}
                onSelectTask={(taskId) => setDetailTaskId(taskId)}
              />
            </div>
            <div className={styles.desktopTable}>
              <ImplementationExecutionBoardTable
                board={board}
                selectedTaskId={detailTaskId}
                codeAgentWipExecutionV1={codeAgentWipExecutionV1}
                taskCursorExecutionV1={taskCursorExecutionV1}
                taskCursorExecutionHistoryV1={taskCursorExecutionHistoryV1}
                codeAgentProgress={codeAgentProgress}
                onSelectTask={(taskId) => setDetailTaskId(taskId)}
              />
            </div>
          </div>
        </div>
      </details>

      <details className={styles.disclosure} data-testid="implementation-integrated-disclosure">
        <summary className={styles.disclosureSummary} aria-expanded={false}>
          통합 단계 {integratedCompleted}/{integratedTotal}
        </summary>
        <div className={styles.disclosureBody}>
          <div className={styles.mobileCardList}>
            {board.integratedRows.map((row) => (
              <div
                key={row.step}
                className={
                  shouldEmphasizeIntegratedStep(row.status)
                    ? `${styles.integratedRow} ${styles.integratedRowEmphasis}`
                    : styles.integratedRow
                }
              >
                <span>{row.title}</span>
                <span>{formatImplementationBoardStepStatusKo(row.status)}</span>
              </div>
            ))}
          </div>
          <div className={styles.desktopTable}>
            <ImplementationExecutionBoardIntegratedTable rows={board.integratedRows} />
          </div>
        </div>
      </details>

      {detailRow ? (
        <details className={styles.disclosure} data-testid="implementation-selected-task-detail">
          <summary className={styles.disclosureSummary}>선택 작업 상세 · {detailRow.taskId}</summary>
          <div className={styles.disclosureBody}>
            <ImplementationExecutionBoardDetail
              row={detailRow}
              codeAgentWipExecutionV1={codeAgentWipExecutionV1}
              nextActions={nextActions}
              onAction={onAction}
              onClose={() => setDetailTaskId(null)}
            />
          </div>
        </details>
      ) : null}

      <details className={styles.envDetails} data-testid="implementation-env-details">
        <summary className={styles.disclosureSummary}>환경설정 상세 보기</summary>
        <div className={styles.envDetailBody}>
          <div className={styles.envDetailHeader}>
            <span
              className={pillClass(summaryView.taskCursorSetupReadiness.ready ? "ok" : "warn")}
              data-testid="implementation-env-readiness-pill"
            >
              Task Cursor:{" "}
              {formatTaskCursorSetupReadinessPillValue(summaryView.taskCursorSetupReadiness)}
            </span>
            {onOpenEnvSettings ? (
              <button
                type="button"
                className={styles.envSettingsBtn}
                data-testid="implementation-env-open-settings"
                onClick={onOpenEnvSettings}
              >
                환경설정 열기
              </button>
            ) : null}
          </div>
          <p className={styles.envDetailReason} data-testid="implementation-env-readiness-reason">
            {summaryView.taskCursorSetupReadiness.reason}
          </p>
          {summaryView.taskCursorSetupReadiness.warnings.length ? (
            <ul className={styles.envWarningList} data-testid="implementation-env-warnings">
              {summaryView.taskCursorSetupReadiness.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <pre className={styles.envPre} data-testid="implementation-env-diagnostic">
            {summaryView.envDiagnosticLines.join("\n")}
          </pre>
        </div>
      </details>
    </section>
  );
}
