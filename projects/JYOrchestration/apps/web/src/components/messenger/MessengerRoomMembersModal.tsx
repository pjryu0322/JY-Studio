"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { formatParticipantStatusSubtitle } from "@/components/workspace/participantOptionPresentation";
import { WorkspaceAiParticipantAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import { Button, uiTokens as t } from "@/components/ui";
import styles from "@/components/workspace/workspaceParticipantsModal.module.css";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";

function partitionParticipants(participants: readonly ParticipantOption[]) {
  const humans = participants.filter((x): x is ParticipantOption => x.kind === "human");
  const ais = participants.filter((x): x is ParticipantOption => x.kind === "ai");
  const humansOrdered = [...humans.filter((h) => h.onlineHint), ...humans.filter((h) => !h.onlineHint)];
  return { humansOrdered, ais };
}

function HumanAvatarPlaceholder({ name }: { readonly name: string }) {
  const ch = String(name ?? "").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        fontWeight: 900,
        color: "#475569",
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      {ch}
    </div>
  );
}

function sectionLabelStyle(isFirst: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    color: t.textMuted,
    letterSpacing: "0.03em",
    marginTop: isFirst ? 0 : 14,
    marginBottom: 8,
  };
}

export function MessengerRoomMembersModal(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly roomId: string;
  readonly participants: readonly ParticipantOption[];
  readonly aiParticipationMode: MessengerAiMode;
}) {
  const [copyDone, setCopyDone] = useState(false);
  const { humansOrdered, ais } = useMemo(() => partitionParticipants(p.participants), [p.participants]);
  const total = humansOrdered.length + ais.length;

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return `/chat/${encodeURIComponent(p.roomId)}`;
    return `${window.location.origin}/chat/${encodeURIComponent(p.roomId)}`;
  }, [p.roomId]);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2400);
    } catch {
      setCopyDone(false);
    }
  }, [inviteUrl]);

  if (!p.open) return null;

  const aiModeHint =
    p.aiParticipationMode === "NONE"
      ? "이 방은 AI 없이 메모만 작성하는 모드입니다."
      : p.aiParticipationMode === "MENTION_ONLY"
        ? "AI는 @@AI기획자 또는 @@기획자로 부를 때만 응답합니다."
        : "AI가 메시지에 자동으로 응답합니다.";

  const renderParticipantRow = (m: ParticipantOption) => (
    <div
      key={m.id}
      role="listitem"
      className={`${styles.row}${m.kind === "ai" && m.isCurrentScreenAi ? ` ${styles.rowCurrent}` : ""}`}
    >
      <div className={styles.rowMain}>
        {m.kind === "ai" ? (
          <WorkspaceAiParticipantAvatar participant={m} size={36} className={styles.rowAvatar} />
        ) : (
          <HumanAvatarPlaceholder name={m.name} />
        )}
        <div className={styles.rowText}>
          <div className={styles.name}>{m.name}</div>
          <div className={styles.meta}>{formatParticipantStatusSubtitle(m, "modal")}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="참여 멤버 및 초대"
      className={styles.scrim}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div className={styles.panel} onPointerDown={(e) => e.stopPropagation()} style={{ maxHeight: "min(88vh, 580px)" }}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>참여 멤버</div>
            <div className={styles.subtitle}>
              총 {total}명
              {total > 0 ? ` · 사람 ${humansOrdered.length} · AI ${ais.length}` : null}
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => p.onClose()} aria-label="닫기" className={styles.closeBtn}>
              ×
            </button>
          </div>
        </div>

        <div className={styles.listWrap}>
          <div style={sectionLabelStyle(true)}>사람</div>
          <div role="list" className={styles.list} aria-label="참여 중인 사람">
            {humansOrdered.length === 0 ? (
              <div className={styles.empty} style={{ padding: "14px 12px", fontSize: 12.5 }}>
                참여 중인 사람 멤버가 없습니다.
              </div>
            ) : (
              humansOrdered.map(renderParticipantRow)
            )}
          </div>

          <div style={sectionLabelStyle(false)}>AI</div>
          {p.aiParticipationMode === "NONE" ? (
            <div
              style={{
                fontSize: 12,
                color: t.textSecondary,
                lineHeight: 1.5,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px dashed ${t.borderStrong}`,
                background: t.bgPage,
              }}
            >
              {aiModeHint} 대화 설정에서 AI 참여를 켤 수 있습니다.
            </div>
          ) : ais.length === 0 ? (
            <div className={styles.empty} style={{ padding: "14px 12px", fontSize: 12.5 }}>
              AI 멤버가 아직 연결되지 않았습니다.
            </div>
          ) : (
            <div role="list" className={styles.list} aria-label="참여 중인 AI">
              {ais.map(renderParticipantRow)}
            </div>
          )}

          {p.aiParticipationMode !== "NONE" && ais.length > 0 ? (
            <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, margin: "12px 0 0", padding: "0 2px" }}>
              {aiModeHint} 다른 AI 역할은 프로젝트룸에서 확장됩니다.
            </p>
          ) : null}
        </div>

        <div
          style={{
            padding: "14px 16px 16px",
            borderTop: `1px solid ${t.border}`,
            background: "linear-gradient(180deg, #fafbfc 0%, #fff 100%)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>초대</div>
          <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, margin: "0 0 12px" }}>
            아래 링크를 공유할 수 있습니다. 초대 수락 및 권한 처리는 후속 단계에서 연결됩니다.
          </p>
          <Button type="button" variant="secondary" size="md" onClick={() => void copyInvite()}>
            {copyDone ? "복사됨" : "초대 링크 복사"}
          </Button>
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#f8fafc",
              border: `1px solid ${t.border}`,
              fontSize: 11,
              color: t.textMuted,
              wordBreak: "break-all",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              lineHeight: 1.4,
            }}
          >
            {inviteUrl}
          </div>
        </div>
      </div>
    </div>
  );
}
