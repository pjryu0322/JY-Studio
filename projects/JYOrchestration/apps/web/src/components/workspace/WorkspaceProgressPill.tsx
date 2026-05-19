"use client";

import type { RefObject } from "react";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import styles from "@/components/workspace/workspaceProgressPill.module.css";

export type WorkspaceIdeationInterviewProgressUi = {
  readonly active: boolean;
  readonly readinessPercent: number;
  readonly covered: number;
  readonly total: number;
  readonly statusCounts?: Readonly<{
    confirmed: number;
    partial: number;
    candidate: number;
    stale: number;
    empty: number;
  }> | null;
  readonly remainingQuestionsEstimate: number;
  readonly onForceGeneratePlanNow: () => void;
  /** 오케스트레이션 해시가 현재 슬롯 정의와 일치할 때 역할별 슬롯 그리드 */
  readonly orchestrationSlotSections?: readonly OrchestrationSlotSummarySection[] | null;
};

export function WorkspaceProgressPill({
  interviewUi,
}: {
  readonly interviewUi: WorkspaceIdeationInterviewProgressUi;
  /** legacy: kept for call sites, no longer used */
  readonly headerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={styles.root} title="서비스 기획 진행도 (가중치: 확정 1 · 부분 0.5 · 후보 0.25)">
      <div className={styles.trigger} aria-label="서비스 기획 진행도">
        <span className={styles.nowrap}>서비스 기획 진행도 {interviewUi.readinessPercent}%</span>
        {interviewUi.statusCounts ? (
          <>
            <span className={styles.sep}>·</span>
            <span className={styles.count}>
              확정 {interviewUi.statusCounts.confirmed} / 부분 {interviewUi.statusCounts.partial} / 후보{" "}
              {interviewUi.statusCounts.candidate}
            </span>
          </>
        ) : (
          <>
            <span className={styles.sep}>·</span>
            <span className={styles.count}>
              {interviewUi.covered}/{interviewUi.total}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
