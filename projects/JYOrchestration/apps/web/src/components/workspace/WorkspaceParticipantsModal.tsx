"use client";

/**
 * 프로젝트 워크스페이스 공통 — 참여 멤버 목록 모달(요구사항·서비스 흐름·기능 정리·프로토타입 미리보기 등).
 */
import { useMemo } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import {
  formatParticipantStatusSubtitle,
  sortParticipantsForPresenceList,
} from "@/components/workspace/participantOptionPresentation";
import { WorkspaceAiParticipantAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import styles from "@/components/workspace/workspaceParticipantsModal.module.css";

export function WorkspaceParticipantsModal(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly participants: readonly ParticipantOption[];
  readonly showInvite: boolean;
  readonly inviteDisabled: boolean;
  readonly onInviteClick: () => void;
}) {
  const ordered = useMemo(() => sortParticipantsForPresenceList(p.participants), [p.participants]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="참여 멤버"
      className={styles.scrim}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div className={styles.panel} onPointerDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>참여 멤버</div>
            <div className={styles.subtitle}>{ordered.length}명</div>
          </div>
          <div className={styles.actions}>
            {p.showInvite ? (
              <button type="button" disabled={p.inviteDisabled} onClick={() => p.onInviteClick()} className={styles.inviteBtn}>
                멤버 초대
              </button>
            ) : null}
            <button type="button" onClick={() => p.onClose()} aria-label="닫기" className={styles.closeBtn}>
              ×
            </button>
          </div>
        </div>

        <div className={styles.listWrap}>
          <div role="list" className={styles.list}>
            {ordered.map((m) => (
              <div
                key={m.id}
                role="listitem"
                className={`${styles.row}${m.kind === "ai" && m.isCurrentScreenAi ? ` ${styles.rowCurrent}` : ""}`}
              >
                <div className={styles.rowMain}>
                  {m.kind === "ai" ? <WorkspaceAiParticipantAvatar participant={m} size={36} className={styles.rowAvatar} /> : null}
                  <div className={styles.rowText}>
                    <div className={styles.name}>{m.name}</div>
                    <div className={styles.meta}>{formatParticipantStatusSubtitle(m, "modal")}</div>
                  </div>
                </div>
              </div>
            ))}
            {!ordered.length ? <div className={styles.empty}>표시할 멤버가 없습니다.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
