"use client";

import type {
  CodeAgentExecutionProgressView,
  CodeAgentExecutionProgressStep,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function stepClass(state: CodeAgentExecutionProgressView["steps"][number]["state"]): string {
  if (state === "done") return `${styles.progressStep} ${styles.progressStepDone}`;
  if (state === "active") return `${styles.progressStep} ${styles.progressStepActive}`;
  if (state === "failed") return `${styles.progressStep} ${styles.progressStepFailed}`;
  return styles.progressStep;
}

function ProgressTechnicalDetails({ progress }: { readonly progress: CodeAgentExecutionProgressView }) {
  return (
    <>
      <div className={styles.progressMetaBlock}>
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
            <span className={styles.progressMetaKey}>{progress.isStubResult ? "WIP SHA" : "커밋"}</span>
            <span data-testid={progress.isStubResult ? "code-agent-wip-stub-sha" : undefined}>
              {progress.commitShaDisplay}
            </span>
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
        {progress.scmStatusLabel ? (
          <div className={styles.progressMetaLine}>
            <span className={styles.progressMetaKey}>SCM</span>
            <span data-testid="code-agent-scm-status">{progress.scmStatusLabel}</span>
          </div>
        ) : null}
        {progress.runId ? (
          <div className={styles.progressMetaLine}>
            <span className={styles.progressMetaKey}>runId</span>
            <span>{progress.runId}</span>
          </div>
        ) : null}
        {progress.failureReason ? (
          <div className={styles.progressFailure} data-testid="code-agent-wip-failure-reason">
            {progress.failureReason}
          </div>
        ) : null}
      </div>

      <div className={styles.progressSteps} aria-label="실행 단계 상세">
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
    </>
  );
}

function CompactProgressSteps({
  steps,
}: {
  readonly steps: readonly CodeAgentExecutionProgressStep[];
}) {
  if (!steps?.length) return null;
  return (
    <div className={styles.compactProgressSteps} aria-label="진행 단계">
      {steps.map((step) => (
        <div key={step.id} className={stepClass(step.state)}>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ImplementationCodeAgentExecutionProgressCard({
  progress,
}: {
  readonly progress: CodeAgentExecutionProgressView;
}) {
  const compact = progress.compactMainPresentation === true;
  const title = progress.progressCardTitle ?? "현재 실행 상태";

  return (
    <div className={styles.progressCard} data-testid="implementation-code-agent-progress-card">
      <div className={styles.progressTitle}>{title}</div>

      {progress.selectedTaskId ? (
        <div className={styles.currentTaskBlock} data-testid="implementation-current-task-block">
          <div className={styles.currentTaskId}>{progress.selectedTaskId}</div>
          {progress.selectedTaskTitle ? (
            <div className={styles.currentTaskTitle}>{progress.selectedTaskTitle}</div>
          ) : null}
        </div>
      ) : progress.status === "idle" ? (
        <div className={styles.currentTaskEmpty} data-testid="implementation-current-task-empty">
          현재 실행 작업 없음
        </div>
      ) : null}

      <div className={styles.progressStatusRow}>
        <span className={styles.progressStatusLabel}>상태</span>
        <span className={styles.progressStatusValue} data-testid="code-agent-progress-status">
          {progress.statusLabel}
        </span>
      </div>
      <div className={styles.progressSummary}>{progress.summaryLine}</div>

      {progress.nextProcessingHint ? (
        <div className={styles.progressNextHint} data-testid="implementation-next-processing-hint">
          {progress.nextProcessingHint}
        </div>
      ) : null}

      {compact && progress.compactSteps?.length ? (
        <CompactProgressSteps steps={progress.compactSteps} />
      ) : null}

      {compact ? (
        <details className={styles.progressDetails} data-testid="implementation-progress-details">
          <summary className={styles.disclosureSummary}>상세 보기</summary>
          <div className={styles.progressDetailsBody}>
            <ProgressTechnicalDetails progress={progress} />
          </div>
        </details>
      ) : (
        <ProgressTechnicalDetails progress={progress} />
      )}
    </div>
  );
}
