"use client";

import type { CodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function stepClass(state: CodeAgentExecutionProgressView["steps"][number]["state"]): string {
  if (state === "done") return `${styles.progressStep} ${styles.progressStepDone}`;
  if (state === "active") return `${styles.progressStep} ${styles.progressStepActive}`;
  if (state === "failed") return `${styles.progressStep} ${styles.progressStepFailed}`;
  return styles.progressStep;
}

export function ImplementationCodeAgentExecutionProgressCard({
  progress,
}: {
  readonly progress: CodeAgentExecutionProgressView;
}) {
  return (
    <div className={styles.progressCard} data-testid="implementation-code-agent-progress-card">
      <div className={styles.progressTitle}>Code Agent 실행 진행</div>
      <div className={styles.progressStatusRow}>
        <span className={styles.progressStatusLabel}>현재 상태</span>
        <span className={styles.progressStatusValue} data-testid="code-agent-progress-status">
          {progress.statusLabel}
        </span>
      </div>
      <div className={styles.progressSummary}>{progress.summaryLine}</div>

      {progress.selectedTaskId ? (
        <div className={styles.progressMetaBlock}>
          <div className={styles.progressMetaLine}>
            <span className={styles.progressMetaKey}>선택 작업</span>
            <span>
              {progress.selectedTaskId}
              {progress.selectedTaskTitle ? ` · ${progress.selectedTaskTitle}` : ""}
            </span>
          </div>
          <div className={styles.progressMetaLine}>
            <span className={styles.progressMetaKey}>실제 Cursor API</span>
            <span data-testid="code-agent-cursor-api-label">{progress.cursorApiLabel}</span>
          </div>
          {progress.branchName ? (
            <div className={styles.progressMetaLine}>
              <span className={styles.progressMetaKey}>브랜치</span>
              <span>{progress.branchName}</span>
            </div>
          ) : null}
          {progress.commitShaDisplay ? (
            <div className={styles.progressMetaLine}>
              <span className={styles.progressMetaKey}>커밋</span>
              <span>{progress.commitShaDisplay}</span>
            </div>
          ) : null}
          {progress.isStubResult ? (
            <div className={styles.progressStubNotice} data-testid="code-agent-stub-notice">
              WIP stub · 실제 Cursor API 미실행
            </div>
          ) : null}
          {progress.changedFileCount > 0 && !progress.isStubResult ? (
            <div className={styles.progressMetaLine}>
              <span className={styles.progressMetaKey}>변경 파일</span>
              <span>{progress.changedFileCount}개 · 테스트 {progress.testStatusLabel}</span>
            </div>
          ) : null}
          {progress.runId ? (
            <div className={styles.progressMetaLine}>
              <span className={styles.progressMetaKey}>runId</span>
              <span>{progress.runId}</span>
            </div>
          ) : null}
          {progress.failureReason ? (
            <div className={styles.progressFailure}>{progress.failureReason}</div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.progressSteps} aria-label="실행 단계">
        {progress.steps.map((step, index) => (
          <div key={step.id} className={stepClass(step.state)}>
            <span className={styles.progressStepIndex}>{index + 1}</span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {progress.recentEvents.length ? (
        <div className={styles.progressEvents}>
          <div className={styles.progressEventsTitle}>최근 이벤트</div>
          <ul className={styles.progressEventsList}>
            {progress.recentEvents.map((event) => (
              <li key={event.id} className={styles.progressEventItem}>
                <span className={styles.progressEventTime}>{event.timeLabel}</span>
                <span>{event.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
