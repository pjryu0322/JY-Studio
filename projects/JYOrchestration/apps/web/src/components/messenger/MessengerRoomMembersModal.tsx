"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { formatParticipantStatusSubtitle } from "@/components/workspace/participantOptionPresentation";
import { WorkspaceAiParticipantAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import { Button, InlineAlert, uiTokens as t } from "@/components/ui";
import styles from "@/components/workspace/workspaceParticipantsModal.module.css";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import {
  fetchMessengerFriends,
  fetchPendingChatRoomMemberInvites,
  requestChatRoomMemberInvite,
  type MessengerFriendApiRow,
} from "@/lib/messenger/messengerFriendApi";

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
  readonly onMembershipChanged?: () => void;
}) {
  const { humansOrdered, ais } = useMemo(() => partitionParticipants(p.participants), [p.participants]);
  const total = humansOrdered.length + ais.length;

  const memberUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const h of humansOrdered) {
      const raw = h.id.startsWith("human:") ? h.id.slice(6) : h.id;
      if (raw) ids.add(raw);
    }
    return ids;
  }, [humansOrdered]);

  const [friends, setFriends] = useState<readonly MessengerFriendApiRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<
    readonly { inviteId: string; inviteeUserId: string; displayName: string }[]
  >([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInviteData = useCallback(async () => {
    if (!p.open || !p.roomId) return;
    setLoadError(null);
    try {
      const [friendRows, pending] = await Promise.all([
        fetchMessengerFriends(),
        fetchPendingChatRoomMemberInvites(p.roomId),
      ]);
      setFriends(friendRows);
      setPendingInvites(pending);
    } catch {
      setLoadError("친구·참여 요청 정보를 불러오지 못했습니다.");
    }
  }, [p.open, p.roomId]);

  useEffect(() => {
    void loadInviteData();
  }, [loadInviteData]);

  const inviteableFriends = useMemo(
    () => friends.filter((f) => !memberUserIds.has(f.id) && !pendingInvites.some((pi) => pi.inviteeUserId === f.id)),
    [friends, memberUserIds, pendingInvites]
  );

  const sendInvite = useCallback(
    async (friend: MessengerFriendApiRow) => {
      setInviteBusyId(friend.id);
      setInviteMessage(null);
      try {
        const result = await requestChatRoomMemberInvite(p.roomId, friend.id);
        if (!result.ok) {
          setInviteMessage(result.message || "참여 요청에 실패했습니다.");
          return;
        }
        setInviteMessage(result.message || "참여 요청을 보냈습니다.");
        await loadInviteData();
        p.onMembershipChanged?.();
      } finally {
        setInviteBusyId(null);
      }
    },
    [p.roomId, loadInviteData, p.onMembershipChanged]
  );

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
          <div style={{ fontSize: 13, fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>친구에게 참여 요청</div>
          <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5, margin: "0 0 12px" }}>
            친구 목록에 있는 사용자에게만 참여 요청을 보낼 수 있습니다. 상대가 알림에서 수락하면 참여 멤버로 추가됩니다.
          </p>

          {loadError ? <InlineAlert variant="danger">{loadError}</InlineAlert> : null}
          {inviteMessage ? (
            <div style={{ marginBottom: 10 }}>
              <InlineAlert variant="info">{inviteMessage}</InlineAlert>
            </div>
          ) : null}

          {pendingInvites.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>대기 중인 요청</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingInvites.map((pi) => (
                  <div
                    key={pi.inviteId}
                    style={{
                      fontSize: 12,
                      color: t.textSecondary,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {pi.displayName} — 수락 대기
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {inviteableFriends.length === 0 ? (
            <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
              초대할 친구가 없습니다. 홈의 「친구」 탭에서 친구를 추가한 뒤 다시 시도해 주세요.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
              {inviteableFriends.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.bgCard,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary }}>{f.displayName}</div>
                    {f.email ? (
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, wordBreak: "break-all" }}>{f.email}</div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={inviteBusyId !== null}
                    onClick={() => void sendInvite(f)}
                  >
                    {inviteBusyId === f.id ? "전송 중…" : "참여 요청"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
