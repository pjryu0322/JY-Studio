"use client";

import type { CodeAgentExecutionProgressStep } from "@/lib/prototype/codeAgentExecutionProgressView";
import type { CodeTaskInlineExecutionDetail } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { CODE_TASK_INLINE_TIMELINE_HINT } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import type { CodeTaskExecutionFlowStepVm } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { ProgressTechnicalDetails } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function pipelineStepClass(state: CodeAgentExecutionProgressStep["state"]): string {
  if (state === "done") return `${styles.progressStep} ${styles.progressStepDone}`;
  if (state === "active") return `${styles.progressStep} ${styles.progressStepActive}`;
  if (state === "failed") return `${styles.progressStep} ${styles.progressStepFailed}`;
  return styles.progressStep;
}

function ExecutionFlowSteps({ steps }: { readonly steps: readonly CodeTaskExecutionFlowStepVm[] }) {
  if (!steps.length) return null;
  return (
    <ol className={styles.taskTreeFlowList}>
      {steps.map((step) => {
        const marker =
          step.state === "done"
            ? "✓"
            : step.state === "active"
              ? "●"
              : step.state === "failed"
                ? "✕"
                : step.state === "skipped"
                  ? "−"
                  : "○";
        return (
          <li
            key={step.id}
            className={[
              styles.taskTreeFlowItem,
              step.state === "active" ? styles.taskTreeFlowItemActive : "",
              step.state === "done" ? styles.taskTreeFlowItemDone : "",
              step.state === "failed" ? styles.taskTreeFlowItemFailed : "",
              step.state === "skipped" ? styles.taskTreeFlowItemSkipped : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.taskTreeFlowMarker} aria-hidden>
              {marker}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CodeTaskInlineExecutionDetailBlock({
  detail,
  onCancelPolling,
  onResumeStatusCheck,
}: {
  readonly detail: CodeTaskInlineExecutionDetail;
  readonly onCancelPolling?: () => void;
  readonly onResumeStatusCheck?: () => void;
}) {
  const hasFlowDetails =
    Boolean(detail.executionFlowSteps?.length) || Boolean(detail.pipelineSteps?.length);
  const hasTechnicalDetails = Boolean(detail.technicalProgress);

  return (
    <div className={styles.taskTreeInlineExecution} data-testid="implementation-code-task-inline-execution">
      <div className={styles.taskTreeInlineScope} data-testid="implementation-code-task-inline-scope">
        {detail.scopeLine}
      </div>
      <div className={styles.taskTreeInlineSummary} data-testid="implementation-code-task-inline-summary">
        {detail.compactLine}
      </div>
      {detail.summaryLine && detail.summaryLine !== detail.compactLine ? (
        <div className={styles.taskTreeInlineHint}>{detail.summaryLine}</div>
      ) : null}
      {detail.canCancelCloudAgentPolling && onCancelPolling ? (
        <div className={styles.progressCancelRow}>
          <button
            type="button"
            className={styles.progressCancelButton}
            data-testid="task-cursor-cancel-polling-button"
            onClick={onCancelPolling}
          >
            상태 확인 중단
          </button>
          {detail.pollingCancelHint ? (
            <div className={styles.taskTreeInlineCancelHint}>{detail.pollingCancelHint}</div>
          ) : null}
        </div>
      ) : null}
      {detail.canResumeStatusCheck && onResumeStatusCheck ? (
        <div className={styles.progressCancelRow}>
          <button
            type="button"
            className={styles.progressResumeButton}
            data-testid="task-cursor-resume-status-check-button"
            onClick={onResumeStatusCheck}
          >
            상태 다시 확인
          </button>
          {detail.statusCheckResumeHint ? (
            <div className={styles.taskTreeInlineCancelHint}>{detail.statusCheckResumeHint}</div>
          ) : null}
        </div>
      ) : null}
      {hasFlowDetails || hasTechnicalDetails ? (
        <details className={styles.progressDetails} data-testid="implementation-code-task-flow-details">
          <summary className={styles.disclosureSummary}>실행 흐름 보기</summary>
          <div className={styles.progressDetailsBody}>
            {detail.executionFlowSteps?.length ? (
              <ExecutionFlowSteps steps={detail.executionFlowSteps} />
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
            {hasTechnicalDetails ? (
              <details
                className={styles.progressDetailsNested}
                data-testid="implementation-code-task-progress-details"
              >
                <summary className={styles.disclosureSummary}>기술 상세 보기</summary>
                <div className={styles.progressDetailsBody}>
                  <ProgressTechnicalDetails progress={detail.technicalProgress!} />
                </div>
              </details>
            ) : null}
          </div>
        </details>
      ) : null}
      <div className={styles.taskTreeTimelineHint}>{CODE_TASK_INLINE_TIMELINE_HINT}</div>
    </div>
  );
}
