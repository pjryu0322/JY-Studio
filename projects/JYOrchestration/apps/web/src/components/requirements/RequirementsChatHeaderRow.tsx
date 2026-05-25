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
    /** 기획 단계 TopChrome과 동일한 대화 허브 아이콘(빠른실행·슬롯·마크다운 등) */
    readonly iconToolbar?: ReactNode;
    /** 참여 멤버 버튼 앞(화면라벨 등) */
    readonly memberBefore?: ReactNode;
    /** `panel`: 연한 회색 배경(기능 정리 대화창 헤더 등) */
    readonly variant?: "card" | "panel";
    readonly memberButtonTestId?: string;
  }
>(function RequirementsChatHeaderRow(
  { leading, memberControls, iconToolbar, memberBefore, variant = "card", memberButtonTestId },
  ref,
) {
  const membersUi = memberControls ?? null;
  const showRight = Boolean(iconToolbar) || Boolean(membersUi);
  const variantClass = variant === "panel" ? styles.variantPanel : styles.variantCard;

  return (
    <div ref={ref} className={[styles.root, variantClass].join(" ")}>
      <div className={styles.leading}>{leading}</div>
      {showRight ? (
        <div className={styles.right}>
          {iconToolbar}
          {membersUi && !iconToolbar ? (
            <div className={styles.memberCluster}>
              {memberBefore}
              <WorkspaceParticipantButton
                count={membersUi.count}
                onOpen={() => membersUi.onOpen()}
                testId={memberButtonTestId ?? "requirements-members-open"}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
