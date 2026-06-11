"use client";

import { useState, type ReactNode } from "react";
import {
  formatCodeTaskReworkRecommendedActionKo,
  type ImplementationCodeTaskReworkVmV1,
} from "@/lib/prototype/implementationCodeTaskReworkVm";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardReworkCandidates(props: {
  readonly reworkVm: ImplementationCodeTaskReworkVmV1 | null;
  readonly onRestartTask?: (taskId: string) => void;
}): ReactNode {
  if (!props.reworkVm?.candidateCount) return null;
  const [reworkOpen, setReworkOpen] = useState(false);
  return (
    <div className={styles.reworkSummary}>
      <button
        type="button"
        className={styles.reworkToggle}
        aria-expanded={reworkOpen}
        onClick={() => setReworkOpen((open) => !open)}
      >
        {reworkOpen ? "재작업 후보 닫기" : `재작업 후보 ${props.reworkVm.candidateCount}개 보기`}
      </button>
      {reworkOpen ? (
        <ul className={styles.reworkList}>
          {props.reworkVm.candidates.map((candidate) => (
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
                {candidate.recommendedAction === "rerun_task" && props.onRestartTask ? (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className={styles.reworkActionLink}
                      onClick={() => props.onRestartTask!(candidate.parentTaskId)}
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
  );
}
