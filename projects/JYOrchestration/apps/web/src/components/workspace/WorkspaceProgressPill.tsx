"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  PROBLEM_INTERVIEW_SLOTS,
  interviewSlotLevelFromState,
  problemInterviewSlotLabelKr,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import styles from "@/components/workspace/workspaceProgressPill.module.css";

export type WorkspaceIdeationInterviewProgressUi = {
  readonly active: boolean;
  readonly readinessPercent: number;
  readonly covered: number;
  readonly strictFilled: number;
  readonly total: number;
  readonly nextSlot: ProblemInterviewSlot | null;
  readonly remainingQuestionsEstimate: number;
  readonly slotState: ProblemInterviewState | null;
  readonly recentAskedSlots: readonly ProblemInterviewSlot[];
  readonly onForceGeneratePlanNow: () => void;
};

export function WorkspaceProgressPill({
  interviewUi,
  headerRef,
}: {
  readonly interviewUi: WorkspaceIdeationInterviewProgressUi;
  readonly headerRef: RefObject<HTMLDivElement | null>;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slotDetailsOpen, setSlotDetailsOpen] = useState(false);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPopoverOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (headerRef.current?.contains(t)) return;
      setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popoverOpen, headerRef]);

  return (
    <div className={styles.root}>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className={styles.trigger}
        title="아이디어 정리도 상세 보기"
      >
        <span className={styles.nowrap}>아이디어 정리도 {interviewUi.readinessPercent}%</span>
        <span className={styles.sep}>·</span>
        <span className={styles.count}>
          {interviewUi.covered}/{interviewUi.total}
        </span>
      </button>

      {popoverOpen ? (
        <div role="dialog" aria-label="아이디어 정리도 상세" className={styles.popover}>
          <div className={styles.popoverHeader}>
            <div className={styles.popoverTitle}>
              아이디어 정리도 {interviewUi.readinessPercent}% · {interviewUi.covered}/{interviewUi.total}
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${Math.min(100, Math.max(0, interviewUi.readinessPercent))}%` }}
              />
            </div>
          </div>

          <div className={styles.popoverBody}>
            <div className={styles.row}>
              <div className={styles.strong}>
                확보 슬롯: {interviewUi.covered}/{interviewUi.total}
              </div>
              {interviewUi.nextSlot ? (
                <div className={styles.teal}>다음 필요 정보: {problemInterviewSlotLabelKr(interviewUi.nextSlot)}</div>
              ) : null}
              <div className={styles.muted}>예상 남은 질문: {Math.max(0, interviewUi.remainingQuestionsEstimate)}개</div>
            </div>

            <div className={styles.btnRow}>
              <button type="button" onClick={() => setSlotDetailsOpen((v) => !v)} className={styles.btnGhost}>
                슬롯 상세 {slotDetailsOpen ? "접기" : "보기"}
              </button>
              <button type="button" onClick={() => interviewUi.onForceGeneratePlanNow()} className={styles.btnPrimary}>
                지금까지 내용으로 기획안 만들기
              </button>
            </div>

            {slotDetailsOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className={styles.legend}>
                  <span className={styles.legendLabel}>표시:</span>
                  <span className={styles.legendItem}>✔ 완료</span>
                  <span className={styles.legendItem}>△ 부분</span>
                  <span className={styles.legendItem}>□ 미확보</span>
                </div>
                <div className={styles.grid}>
                  {PROBLEM_INTERVIEW_SLOTS.map((slot) => {
                    const level = interviewUi.slotState ? interviewSlotLevelFromState(interviewUi.slotState, slot) : "empty";
                    const icon = level === "filled" ? "✔" : level === "partial" ? "△" : "□";
                    const color = level === "filled" ? "#065f46" : level === "partial" ? "#92400e" : "#475569";
                    const bg = level === "filled" ? "#ecfdf5" : level === "partial" ? "#fffbeb" : "#f8fafc";
                    const border = level === "filled" ? "1px solid #a7f3d0" : level === "partial" ? "1px solid #fde68a" : "1px solid #e2e8f0";
                    return (
                      <div key={slot} className={styles.slotCell} style={{ border, background: bg }}>
                        <span className={styles.slotLabel}>{problemInterviewSlotLabelKr(slot)}</span>
                        <span className={styles.slotIcon} style={{ color }}>
                          {icon}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {interviewUi.recentAskedSlots.length ? (
                  <div className={styles.recentRow}>
                    <span className={styles.recentLabel}>최근 질문:</span>
                    {interviewUi.recentAskedSlots.slice(-6).map((s, idx) => (
                      <span key={`${s}-${idx}`} className={styles.chip}>
                        {problemInterviewSlotLabelKr(s)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
