"use client";

import type { ReactNode } from "react";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardRuntimeAdmin(props: {
  readonly showStuckRecovery: boolean;
  readonly stuckRecoveryHint: string | null;
  readonly onRetryGithubVerify?: () => void;
  readonly onRestartTask?: (taskId: string) => void;
  readonly queueParentTaskId: string | null;
  readonly projectId?: string;
  readonly selectedCodeTaskId: string | null;
  readonly queueCurrentCodeTaskId: string | null;
}): ReactNode {
  if (!props.showStuckRecovery) {
    return null;
  }
  return (
    <div className={styles.runtimeAdminActions} data-testid="code-task-stuck-recovery">
      {props.stuckRecoveryHint ? (
        <span className={styles.githubVerifyAutoStatus}>{props.stuckRecoveryHint}</span>
      ) : null}
      <div className={styles.stuckRecoveryActions}>
        {props.onRetryGithubVerify ? (
          <button type="button" className={styles.githubVerifyRetryLink} onClick={props.onRetryGithubVerify}>
            상태 재확인
          </button>
        ) : null}
        {props.onRestartTask && props.queueParentTaskId ? (
          <button
            type="button"
            className={styles.githubVerifyRetryLink}
            onClick={() => props.onRestartTask!(props.queueParentTaskId!)}
          >
            이 CodeTask 재실행
          </button>
        ) : null}
        {props.projectId && (props.selectedCodeTaskId ?? props.queueCurrentCodeTaskId) ? (
          <button
            type="button"
            className={styles.githubVerifyRetryLink}
            onClick={() => {
              const codeTaskId = (props.selectedCodeTaskId ?? props.queueCurrentCodeTaskId)!.trim();
              void fetch(`/api/projects/${props.projectId!.trim()}/implementation-runtime/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "skip_code_task", codeTaskId }),
              });
            }}
          >
            이 CodeTask 건너뛰기
          </button>
        ) : null}
        {props.projectId ? (
          <button
            type="button"
            className={styles.githubVerifyRetryLink}
            onClick={() => {
              void fetch(`/api/projects/${props.projectId!.trim()}/implementation-runtime/actions`, {
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
  );
}
