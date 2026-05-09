"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Card, EmptyState, InlineAlert, uiTokens as t } from "@/components/ui";
import { aiMemberStatusLabel, MESSENGER_HOME_AI_CATALOG } from "@/lib/messenger/messengerHomeAiCatalog";
import type { HumanFriendStatus, HumanMember } from "@/lib/messenger/messengerHomeMemberTypes";
import { loadMessengerFriendsFromStorage, saveMessengerFriendsToStorage } from "@/lib/messenger/messengerLocalFriendsStorage";
import type { PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { MessengerFriendAddSheet } from "./MessengerFriendAddSheet";

type MembersSubTab = "human" | "ai";

function subTabPill(active: boolean): CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? t.accentTealFg : t.border}`,
    background: active ? t.accentTealSurface : t.bgCard,
    color: active ? t.accentTealFg : t.textSecondary,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function humanStatusLabel(status: HumanFriendStatus): string {
  switch (status) {
    case "FRIEND":
      return "친구";
    case "INVITED":
      return "초대 대기";
    case "PENDING":
      return "수락 대기";
    case "INACTIVE":
      return "비활성";
    default:
      return "";
  }
}

function HumanMemberCard(p: {
  readonly member: HumanMember;
  readonly selected: boolean;
  readonly onToggleSelect: () => void;
  readonly onStartChat: () => void;
  readonly startBusy: boolean;
}) {
  const { member } = p;
  const secondary = member.email ?? member.id;
  return (
    <Card compact>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: p.startBusy ? "not-allowed" : "pointer",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <input
            type="checkbox"
            checked={p.selected}
            disabled={p.startBusy}
            onChange={() => p.onToggleSelect()}
            aria-label={`${member.displayName} 선택`}
          />
        </label>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>{member.displayName}</div>
          {secondary ? (
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, wordBreak: "break-all" }}>{secondary}</div>
          ) : null}
          <div style={{ fontSize: 12, color: t.accentTealFg, fontWeight: 800, marginTop: 8 }}>상태 · {humanStatusLabel(member.status)}</div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button type="button" variant="secondary" size="sm" disabled={p.startBusy} onClick={() => p.onStartChat()}>
              대화 시작
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function displayNameFromPlatformUser(u: PlatformUserRow): string {
  const d = (u.displayName ?? "").trim();
  if (d) return d;
  const n = (u.name ?? "").trim();
  if (n) return n;
  return u.email;
}

export function MessengerHomeMembersSection() {
  const [sub, setSub] = useState<MembersSubTab>("human");
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
  const [friendSheetKey, setFriendSheetKey] = useState(0);
  const [humanFriends, setHumanFriends] = useState<readonly HumanMember[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(() => new Set());
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    setHumanFriends(loadMessengerFriendsFromStorage());
  }, []);

  useEffect(() => {
    setSelectedFriendIds((prev) => new Set([...prev].filter((id) => humanFriends.some((m) => m.id === id))));
  }, [humanFriends]);

  const existingFriendUserIds = useMemo(() => new Set(humanFriends.map((m) => m.id)), [humanFriends]);

  const selectedCount = selectedFriendIds.size;
  const allFriendsSelected = humanFriends.length > 0 && humanFriends.every((m) => selectedFriendIds.has(m.id));

  const openFriendSheet = useCallback(() => {
    setFriendSheetKey((k) => k + 1);
    setFriendSheetOpen(true);
  }, []);
  const closeFriendSheet = useCallback(() => setFriendSheetOpen(false), []);

  const addFriendFromPlatformUser = useCallback((u: PlatformUserRow) => {
    setHumanFriends((prev) => {
      if (prev.some((m) => m.id === u.id)) return prev;
      const nextMember: HumanMember = {
        id: u.id,
        displayName: displayNameFromPlatformUser(u),
        email: u.email,
        status: "FRIEND",
      };
      const merged = [...prev, nextMember];
      saveMessengerFriendsToStorage(merged);
      return merged;
    });
    setFriendSheetOpen(false);
  }, []);

  const toggleFriendSelected = useCallback((id: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllFriends = useCallback(() => {
    setSelectedFriendIds((prev) => {
      if (humanFriends.length === 0) return new Set();
      if (humanFriends.every((m) => prev.has(m.id))) return new Set();
      return new Set(humanFriends.map((m) => m.id));
    });
  }, [humanFriends]);

  const startChatWithUserIds = useCallback(
    async (rawIds: readonly string[]) => {
      const allowed = new Set(humanFriends.map((m) => m.id));
      const ids = [...new Set(rawIds.map((x) => x.trim()).filter((id) => allowed.has(id)))];
      if (ids.length === 0) {
        setStartError("대화에 포함할 친구를 선택해 주세요.");
        return;
      }
      setStartBusy(true);
      setStartError(null);
      try {
        const res = await credentialsIncludeFetch("/api/chat-rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomType: "GROUP",
            aiParticipationMode: "NONE",
            participantUserIds: ids,
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { id?: string };
          message?: string;
        };
        if (!res.ok || !json.success || !json.data?.id) {
          throw new Error(json.message || "대화방을 만들지 못했습니다.");
        }
        window.location.href = `/chat/${encodeURIComponent(json.data.id)}`;
      } catch (e) {
        setStartError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setStartBusy(false);
      }
    },
    [humanFriends]
  );

  const humanHeader = (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 13, color: t.textSecondary, margin: "0 0 10px", lineHeight: 1.5 }}>
        플랫폼에 가입한 사용자 중, 친구로 추가한 사람만 이 목록에 표시됩니다. Chat 유형(AI 없음)으로 대화방을 열 수 있습니다.
      </p>
      <Button type="button" variant="primary" size="md" onClick={openFriendSheet} disabled={startBusy}>
        친구 추가
      </Button>
    </div>
  );

  const subTabRow = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: `1px solid ${t.border}`,
      }}
      role="tablist"
      aria-label="멤버 구분"
    >
      <button type="button" role="tab" aria-selected={sub === "human"} style={subTabPill(sub === "human")} onClick={() => setSub("human")}>
        휴먼멤버
      </button>
      <button type="button" role="tab" aria-selected={sub === "ai"} style={subTabPill(sub === "ai")} onClick={() => setSub("ai")}>
        AI멤버
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
      {subTabRow}

      {sub === "human" ? (
        <>
          {humanHeader}
          {startError ? (
            <div style={{ marginBottom: 10 }}>
              <InlineAlert variant="danger">{startError}</InlineAlert>
            </div>
          ) : null}
          {humanFriends.length === 0 ? (
            <EmptyState
              title="아직 추가된 휴먼멤버가 없습니다."
              description="친구를 추가하면 대화방이나 프로젝트룸에 초대할 수 있습니다."
              action={
                <Button type="button" variant="primary" size="md" onClick={openFriendSheet} disabled={startBusy}>
                  친구 추가
                </Button>
              }
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textSecondary, cursor: startBusy ? "not-allowed" : "pointer" }}>
                  <input type="checkbox" checked={allFriendsSelected} disabled={startBusy} onChange={() => toggleSelectAllFriends()} />
                  전체 선택
                </label>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={startBusy}
                  disabled={startBusy || selectedCount === 0}
                  onClick={() => void startChatWithUserIds([...selectedFriendIds])}
                >
                  선택한 친구와 대화 시작{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {humanFriends.map((m) => (
                  <HumanMemberCard
                    key={m.id}
                    member={m}
                    selected={selectedFriendIds.has(m.id)}
                    onToggleSelect={() => toggleFriendSelected(m.id)}
                    onStartChat={() => void startChatWithUserIds([m.id])}
                    startBusy={startBusy}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: "0 0 12px", lineHeight: 1.5 }}>
            AI멤버는 역할별로 대화와 프로젝트룸에 참여할 수 있습니다. MVP에서는 새 대화 생성 시 AI기획자를 기본으로 선택할 수 있습니다.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MESSENGER_HOME_AI_CATALOG.map((m) => (
              <Card key={m.id} compact>
                <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>{m.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
                  분류: {m.category}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 8, lineHeight: 1.45 }}>설명: {m.description}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: m.status === "AVAILABLE" ? t.accentTealFg : t.textMuted, marginTop: 10 }}>
                  상태: {aiMemberStatusLabel(m.status)}
                </div>
              </Card>
            ))}
          </div>
          <p style={{ fontSize: 11, color: t.textMuted, marginTop: 14, lineHeight: 1.45 }}>
            프로젝트룸에서는 AI 보안관·운영자 등 추가 역할을 사용할 수 있습니다.
          </p>
        </>
      )}

      <MessengerFriendAddSheet
        open={friendSheetOpen}
        sheetKey={friendSheetKey}
        existingFriendUserIds={existingFriendUserIds}
        onClose={closeFriendSheet}
        onPickPlatformUser={addFriendFromPlatformUser}
      />
    </div>
  );
}
