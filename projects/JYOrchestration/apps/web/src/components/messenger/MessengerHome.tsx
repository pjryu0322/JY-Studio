"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ResponsivePageContainer, ResponsiveShell } from "@/components/layout";
import { BottomSheet, Button, Card, EmptyState, InlineAlert, LoadingState, uiTokens as t } from "@/components/ui";
import { MessengerChatRoomRenameModal } from "@/components/messenger/MessengerChatRoomRenameModal";
import { MessengerRoomSettingsGearMenu } from "@/components/messenger/MessengerRoomSettingsGearMenu";
import { MessengerHomeMembersSection } from "@/components/messenger/MessengerHomeMembersSection";
import { parseMessengerHomePanel, type MessengerHomePanel } from "@/components/messenger/messengerHomePanel";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type ChatRoomRow = {
  id: string;
  title: string;
  lastMessagePreview: string | null;
  updatedAt: string;
  projectId: string | null;
  type?: string;
  isOwner?: boolean;
  aiParticipationMode?: string;
};

type CreatePayload = { roomType: "SOLO" | "DIRECT"; aiParticipationMode: "NONE" | "AUTO" | "MENTION_ONLY" };

function NewRoomOptions(p: {
  readonly creating: boolean;
  readonly panel: MessengerHomePanel;
  readonly onPick: (payload: CreatePayload) => void;
}) {
  const soloNone = (
    <button
      key="solo-none"
      type="button"
      disabled={p.creating}
      onClick={() => p.onPick({ roomType: "SOLO", aiParticipationMode: "NONE" })}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        cursor: p.creating ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, color: t.textPrimary }}>혼자 메모하기</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.45 }}>AI 응답 없이 아이디어를 자유롭게 기록합니다.</div>
    </button>
  );
  const directAuto = (
    <button
      key="direct-auto"
      type="button"
      disabled={p.creating}
      onClick={() => p.onPick({ roomType: "DIRECT", aiParticipationMode: "AUTO" })}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        cursor: p.creating ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, color: t.textPrimary }}>AI기획자와 대화하기</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
        AI기획자가 사용자 입력에 응답하며 아이디어를 함께 정리합니다.
      </div>
    </button>
  );
  const directMention = (
    <button
      key="direct-mention"
      type="button"
      disabled={p.creating}
      onClick={() => p.onPick({ roomType: "DIRECT", aiParticipationMode: "MENTION_ONLY" })}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        cursor: p.creating ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, color: t.textPrimary }}>AI기획자 멘션 시만 응답</div>
      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
        AI기획자는 대화방에 있지만 @AI기획자로 부를 때만 응답합니다.
      </div>
    </button>
  );

  /** 레일 Chat = 멘션 우선, AIChat = 자동응답 우선 */
  const orderChat: ReactNode[] = [directMention, directAuto, soloNone];
  const orderAiChat: ReactNode[] = [directAuto, directMention, soloNone];

  return <>{p.panel === "aichat" ? orderAiChat : orderChat}</>;
}

export function MessengerHome() {
  const searchParams = useSearchParams();
  const panel = parseMessengerHomePanel(searchParams.get("panel"));

  const [rooms, setRooms] = useState<ChatRoomRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameInitialTitle, setRenameInitialTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [roomListBusyId, setRoomListBusyId] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setListError(null);
    try {
      const res = await credentialsIncludeFetch("/api/chat-rooms");
      const json = (await res.json()) as {
        success?: boolean;
        data?: { rooms?: (ChatRoomRow & Record<string, unknown>)[] };
        message?: string;
      };
      if (res.status === 401) {
        setRooms([]);
        setListError(json.message || "로그인이 필요합니다.");
        return;
      }
      if (!res.ok || !json.success || !Array.isArray(json.data?.rooms)) {
        setRooms([]);
        setListError(json.message || "대화 목록을 불러오지 못했습니다.");
        return;
      }
      setRooms(
        json.data.rooms.map((row) => ({
          id: String(row.id ?? ""),
          title: String(row.title ?? ""),
          lastMessagePreview: typeof row.lastMessagePreview === "string" ? row.lastMessagePreview : null,
          updatedAt: String(row.updatedAt ?? ""),
          projectId: row.projectId == null ? null : String(row.projectId),
          type: typeof row.type === "string" ? row.type : undefined,
          isOwner: Boolean(row.isOwner),
          aiParticipationMode: typeof row.aiParticipationMode === "string" ? row.aiParticipationMode : undefined,
        }))
      );
    } catch {
      setRooms([]);
      setListError("네트워크 오류가 발생했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const createRoomWithOptions = useCallback(
    async (payload: CreatePayload) => {
      if (creating) return;
      setCreating(true);
      try {
        const res = await credentialsIncludeFetch("/api/chat-rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { success?: boolean; data?: { id?: string }; message?: string };
        if (!res.ok || !json.success || !json.data?.id) {
          setListError(json.message || "대화방을 만들지 못했습니다.");
          return;
        }
        setCreateSheetOpen(false);
        window.location.href = `/chat/${encodeURIComponent(json.data.id)}`;
      } catch {
        setListError("대화방 생성 중 오류가 발생했습니다.");
      } finally {
        setCreating(false);
      }
    },
    [creating]
  );

  const saveRenamedTitle = useCallback(async () => {
    if (!renameRoomId || renameBusy) return;
    const next = renameTitle.trim();
    if (!next) {
      setRenameError("제목을 입력해 주세요.");
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(renameRoomId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      setRenameRoomId(null);
      await loadRooms();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setRenameBusy(false);
    }
  }, [renameRoomId, renameTitle, renameBusy, loadRooms]);

  const deleteRoomFromList = useCallback(
    async (roomId: string) => {
      if (!window.confirm("이 대화방과 모든 메시지를 삭제할까요? 되돌릴 수 없습니다.")) return;
      setRoomListBusyId(roomId);
      setListError(null);
      try {
        const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.message || "삭제에 실패했습니다.");
        }
        await loadRooms();
      } catch (e) {
        setListError(e instanceof Error ? e.message : "삭제 오류");
      } finally {
        setRoomListBusyId(null);
      }
    },
    [loadRooms]
  );

  const leaveRoomFromList = useCallback(
    async (roomId: string) => {
      if (!window.confirm("이 대화방에서 나가시겠습니까? 목록에서 사라지며, 다시 참여하려면 초대가 필요합니다.")) return;
      setRoomListBusyId(roomId);
      setListError(null);
      try {
        const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(roomId)}/leave`, {
          method: "POST",
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.message || "나가기에 실패했습니다.");
        }
        await loadRooms();
      } catch (e) {
        setListError(e instanceof Error ? e.message : "나가기 오류");
      } finally {
        setRoomListBusyId(null);
      }
    },
    [loadRooms]
  );

  const showChatList = panel === "chat" || panel === "aichat";

  return (
    <ResponsiveShell>
      <ResponsivePageContainer
        wide
        data-ui-label="Messenger Home"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingTop: 8,
          paddingBottom: 20,
          maxWidth: "none",
        }}
      >
        {panel === "friends" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0 }}>
            <MessengerHomeMembersSection />
          </div>
        ) : null}

        {showChatList ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="button" variant="primary" size="md" disabled={creating} onClick={() => setCreateSheetOpen(true)}>
                + 새 대화
              </Button>
            </div>
            <BottomSheet open={createSheetOpen} onClose={() => !creating && setCreateSheetOpen(false)} ariaLabel="새 대화 만들기">
              <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary, marginBottom: 4 }}>새 대화 만들기</div>
              <p style={{ fontSize: 12, color: t.textSecondary, margin: "0 0 12px", lineHeight: 1.45 }}>방식을 고른 뒤 대화방이 열립니다.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <NewRoomOptions creating={creating} panel={panel} onPick={(payload) => void createRoomWithOptions(payload)} />
              </div>
              {creating ? (
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10, textAlign: "center" }}>만드는 중…</div>
              ) : null}
            </BottomSheet>
            {listError ? <InlineAlert variant="danger">{listError}</InlineAlert> : null}
            {rooms === null ? (
              <LoadingState />
            ) : rooms.length === 0 ? (
              <EmptyState title="대화방이 없습니다." description="「+ 새 대화」에서 혼자 메모하거나 AI 기획자와 함께 시작해 보세요." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rooms.map((r) => (
                  <Card key={r.id} compact>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Link
                        href={`/chat/${encodeURIComponent(r.id)}`}
                        style={{ flex: "1 1 auto", minWidth: 0, textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary, marginBottom: 4 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>
                          {r.lastMessagePreview?.trim() || "메시지 없음"}
                          {r.projectId ? (
                            <span style={{ marginLeft: 8, fontWeight: 800, color: t.accentTealFg }}>· 프로젝트 연결됨</span>
                          ) : null}
                        </div>
                      </Link>
                      <MessengerRoomSettingsGearMenu
                        disabled={roomListBusyId !== null}
                        showRename
                        showLeave
                        showDelete={r.isOwner === true && !r.projectId}
                        onRename={() => {
                          setRenameRoomId(r.id);
                          setRenameInitialTitle(r.title);
                          setRenameTitle(r.title);
                          setRenameError(null);
                        }}
                        onLeave={() => void leaveRoomFromList(r.id)}
                        onDelete={() => void deleteRoomFromList(r.id)}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <MessengerChatRoomRenameModal
          open={renameRoomId !== null}
          initialTitle={renameInitialTitle}
          value={renameTitle}
          onChange={setRenameTitle}
          onClose={() => !renameBusy && setRenameRoomId(null)}
          onSave={() => void saveRenamedTitle()}
          saving={renameBusy}
          error={renameError}
        />
      </ResponsivePageContainer>
    </ResponsiveShell>
  );
}
