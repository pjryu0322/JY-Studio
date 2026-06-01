"use client";

import type { CodeAgentExecutionProgressStep } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { CodeTaskInlineExecutionDetail } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { CODE_TASK_INLINE_TIMELINE_HINT } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { ProgressTechnicalDetails } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function pipelineStepClass(state: CodeAgentExecutionProgressStep["state"]): string {
  if (state === "done") return `${styles.progressStep} ${styles.progressStepDone}`;
  if (state === "active") return `${styles.progressStep} ${styles.progressStepActive}`;
  if (state === "failed") return `${styles.progressStep} ${styles.progressStepFailed}`;
  return styles.progressStep;
}

export function CodeTaskInlineExecutionDetailBlock({
  detail,
  onCancelPolling,
}: {
  readonly detail: CodeTaskInlineExecutionDetail;
  readonly onCancelPolling?: () => void;
}) {
  return (
    <div className={styles.taskTreeInlineExecution} data-testid="implementation-code-task-inline-execution">
      {detail.summaryLine ? (
        <div className={styles.taskTreeInlineSummary} data-testid="implementation-code-task-inline-summary">
          {detail.summaryLine}
        </div>
      ) : null}
      {detail.nextProcessingHint ? (
        <div className={styles.taskTreeMetaLine}>
          <span className={styles.taskTreeMetaKey}>다음 처리</span>
          <span
            className={styles.taskTreeMetaValue}
            data-testid="implementation-code-task-next-processing-hint"
          >
            {detail.nextProcessingHint}
          </span>
        </div>
      ) : null}
      {detail.pipelineSteps?.length ? (
        <div className={styles.compactProgressSteps} aria-label="파이프라인 진행">
          {detail.pipelineSteps.map((step) => (
            <div key={step.id} className={pipelineStepClass(step.state)}>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {detail.canCancelCloudAgentPolling && onCancelPolling ? (
        <div className={styles.progressCancelRow}>
          <button
            type="button"
            className={styles.progressCancelButton}
            data-testid="task-cursor-cancel-polling-button"
            onClick={onCancelPolling}
          >
            Cloud Agent 폴링 중단
          </button>
        </div>
      ) : null}
      {detail.technicalProgress ? (
        <details className={styles.progressDetails} data-testid="implementation-code-task-progress-details">
          <summary className={styles.disclosureSummary}>상세 보기</summary>
          <div className={styles.progressDetailsBody}>
            <ProgressTechnicalDetails progress={detail.technicalProgress} />
          </div>
        </details>
      ) : null}
      <div className={styles.taskTreeTimelineHint}>{CODE_TASK_INLINE_TIMELINE_HINT}</div>
    </div>
  );
}
