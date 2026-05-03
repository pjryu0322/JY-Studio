"use client";

/**
 * 프로젝트 워크스페이스 공통 — 참여 멤버 목록 모달(요구사항·서비스 흐름·기능 정리·프로토타입 미리보기 등).
 */
import { useMemo } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import styles from "@/components/workspace/workspaceParticipantsModal.module.css";

function sortForModal(participants: readonly ParticipantOption[]): ParticipantOption[] {
  const ais = participants.filter((p) => p.kind === "ai");
  const self = participants.filter((p) => p.kind === "human" && p.onlineHint);
  const others = participants.filter((p) => p.kind === "human" && !p.onlineHint);
  return [...ais, ...self, ...others];
}

function statusSubtitle(p: ParticipantOption): string {
  const parts: string[] = [];
  if (p.kind === "ai") {
    const s = p.aiStatusLabel?.trim();
    if (s) parts.push(s.length > 36 ? `${s.slice(0, 36)}…` : s);
    else parts.push("AI");
  } else {
    const role = p.roleLabel?.trim();
    if (role) parts.push(role);
    if (p.invited) parts.push("초대됨");
    parts.push(p.onlineHint ? "온라인" : "오프라인");
  }
  return parts.join(" · ");
}

export function WorkspaceParticipantsModal(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly participants: readonly ParticipantOption[];
  readonly showInvite: boolean;
  readonly inviteDisabled: boolean;
  readonly onInviteClick: () => void;
}) {
  const ordered = useMemo(() => sortForModal(p.participants), [p.participants]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="참여 멤버"
      className={styles.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
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
              <div key={m.id} role="listitem" className={styles.row}>
                <div className={styles.name}>{m.name}</div>
                <div className={styles.meta}>{statusSubtitle(m)}</div>
              </div>
            ))}
            {!ordered.length ? <div className={styles.empty}>표시할 멤버가 없습니다.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
