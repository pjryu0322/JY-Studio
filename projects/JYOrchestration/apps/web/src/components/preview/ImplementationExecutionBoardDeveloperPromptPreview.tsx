"use client";

import type { ReactNode } from "react";
import { SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW } from "@/lib/prototype/implementationDeveloperPromptPreviewUi";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardDeveloperPromptPreview(props: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly executionTargetCodeTaskId: string | null;
  readonly stageTwoDeveloperPromptPreview: Readonly<{
    readonly title?: string | null;
    readonly branchGroup?: string | null;
    readonly baseBranch?: string | null;
    readonly workBranch?: string | null;
    readonly preview?: string | null;
  }>;
}): ReactNode {
  if (!props.codeTaskPlan || !SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW) return null;
  return (
    <section className={styles.taskTreeSection} data-testid="implementation-stage-two-developer-prompt">
      <div className={styles.integrationSectionHeader}>
        <strong>현재 CodeTask 개발 프롬프트 (2단계 · Cursor 전달용)</strong>
      </div>
      {props.executionTargetCodeTaskId ? (
        <div className={styles.summarySecondary}>
          <div>{props.executionTargetCodeTaskId}</div>
          {props.stageTwoDeveloperPromptPreview.title ? (
            <div>{props.stageTwoDeveloperPromptPreview.title}</div>
          ) : null}
          {props.stageTwoDeveloperPromptPreview.branchGroup ? (
            <div>
              branch group: {props.stageTwoDeveloperPromptPreview.branchGroup} · base branch:{" "}
              {props.stageTwoDeveloperPromptPreview.baseBranch} · work branch:{" "}
              {props.stageTwoDeveloperPromptPreview.workBranch}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.summarySecondary}>실행 대상 CodeTask를 선택해 주세요.</div>
      )}
      {props.stageTwoDeveloperPromptPreview.preview ? (
        <pre
          className={styles.summarySecondary}
          data-testid="implementation-stage-two-developer-prompt-preview"
          style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}
        >
          {props.stageTwoDeveloperPromptPreview.preview.slice(0, 4000)}
        </pre>
      ) : null}
    </section>
  );
}
