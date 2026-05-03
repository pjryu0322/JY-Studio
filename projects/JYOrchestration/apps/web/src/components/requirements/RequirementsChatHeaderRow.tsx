"use client";

import { forwardRef, type ReactNode } from "react";
import { WorkspaceParticipantButton } from "@/components/workspace/WorkspaceParticipantButton";
import styles from "@/components/requirements/requirementsChatHeaderRow.module.css";

/**
 * 아이디어 구체화·서비스 흐름 등 요구사항 협업 채팅 상단 공통 행:
 * 왼쪽 `leading` + 오른쪽 참여 멤버 버튼(선택).
 */
export const RequirementsChatHeaderRow = forwardRef<
  HTMLDivElement,
  {
    readonly leading: ReactNode;
    readonly memberControls?: { readonly count: number; readonly onOpen: () => void } | null;
    /** 참여 멤버 버튼 앞(화면라벨 등) */
    readonly memberBefore?: ReactNode;
    /** `panel`: 연한 회색 배경(기능 정리 대화창 헤더 등) */
    readonly variant?: "card" | "panel";
    readonly memberButtonTestId?: string;
  }
>(function RequirementsChatHeaderRow({ leading, memberControls, memberBefore, variant = "card", memberButtonTestId }, ref) {
  const membersUi = memberControls ?? null;
  const showRight = Boolean(membersUi);
  const variantClass = variant === "panel" ? styles.variantPanel : styles.variantCard;

  return (
    <div ref={ref} className={[styles.root, variantClass].join(" ")}>
      <div className={styles.leading}>{leading}</div>
      {showRight ? (
        <div className={styles.right}>
          <div className={styles.memberCluster}>
            {memberBefore}
            {membersUi ? (
              <WorkspaceParticipantButton
                count={membersUi.count}
                onOpen={() => membersUi.onOpen()}
                testId={memberButtonTestId ?? "requirements-members-open"}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});
