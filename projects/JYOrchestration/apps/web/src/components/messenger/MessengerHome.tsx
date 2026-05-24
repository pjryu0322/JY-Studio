"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ResponsivePageContainer, ResponsiveShell } from "@/components/layout";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { Button, Card, EmptyState, InlineAlert, LoadingState, uiTokens as t } from "@/components/ui";
import {
  MessengerRoomListActionButtons,
  MessengerRoomListTitleField,
} from "@/components/messenger/MessengerRoomListChrome";
import { MessengerHomeMembersSection } from "@/components/messenger/MessengerHomeMembersSection";
import { parseMessengerHomePanel } from "@/components/messenger/messengerHomePanel";
import { createAndOpenMessengerAgentRoom } from "@/lib/messenger/createAndOpenMessengerAgentRoom";
import {
  deleteMessengerChatRoom,
  fetchMessengerChatRooms,
  postMessengerChatRoomLeave,
  type MessengerChatRoomListRow,
} from "@/lib/messenger/messengerChatRoomApi";
import { openMessengerChatRoomWindow } from "@/lib/messenger/openMessengerChatRoomWindow";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import { openProjectRoomWindow } from "@/lib/ui/workspaceMode";

export function MessengerHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveLayout, mode: workspaceMode } = useWorkspaceMode();
  const panel = parseMessengerHomePanel(searchParams.get("panel"));

  const [rooms, setRooms] = useState<MessengerChatRoomListRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [roomListBusyId, setRoomListBusyId] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setListError(null);
    try {
      const result = await fetchMessengerChatRooms();
      if (!result.ok) {
        setRooms([]);
        if (result.status === 401) {
          router.replace(`/login?from=${encodeURIComponent("/")}`);
          return;
        }
        setListError(result.message);
        return;
      }
      setRooms([...result.rooms]);
    } catch {
      setRooms([]);
      setListError("네트워크 오류가 발생했습니다.");
    }
  }, [router]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const openNewAgentRoom = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setListError(null);
    try {
      await createAndOpenMessengerAgentRoom({ effectiveLayout, discardEmptyOnClose: true });
      await loadRooms();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "대화방 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }, [creating, effectiveLayout, loadRooms]);

  const openRoomInWorkModeWindow = useCallback(
    (roomId: string) => {
      const opened = openMessengerChatRoomWindow(roomId, { effectiveLayout, workspaceMode });
      if (!opened) {
        const path = `/chat/${encodeURIComponent(roomId)}`;
        const w = window.open(path, "_blank", "noopener,noreferrer");
        registerPlatformPopupFromOpenedUrl(w, path);
      }
    },
    [effectiveLayout, workspaceMode],
  );

  const openLinkedProjectWindow = useCallback(
    (projectId: string) => {
      const opened = openProjectRoomWindow(projectId, workspaceMode);
      if (!opened) {
        setListError("팝업이 차단되었습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요.");
      }
    },
    [workspaceMode],
  );

  const deleteRoomFromList = useCallback(
    async (roomId: string) => {
      if (!window.confirm("이 대화방과 모든 메시지를 삭제할까요? 되돌릴 수 없습니다.")) return;
      setRoomListBusyId(roomId);
      setListError(null);
      try {
        await deleteMessengerChatRoom(roomId);
        await loadRooms();
      } catch (e) {
        setListError(e instanceof Error ? e.message : "삭제 오류");
      } finally {
        setRoomListBusyId(null);
      }
    },
    [loadRooms],
  );

  const leaveRoomFromList = useCallback(
    async (roomId: string) => {
      if (!window.confirm("이 대화방에서 나가시겠습니까? 목록에서 사라지며, 다시 참여하려면 초대가 필요합니다.")) return;
      setRoomListBusyId(roomId);
      setListError(null);
      try {
        await postMessengerChatRoomLeave(roomId);
        await loadRooms();
      } catch (e) {
        setListError(e instanceof Error ? e.message : "나가기 오류");
      } finally {
        setRoomListBusyId(null);
      }
    },
    [loadRooms],
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
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={creating}
                aria-label="새 AI 대화방 (1:Agent) — 새 창에서 열기"
                title="AI기획자와 새 대화 (새 창)"
                onClick={() => void openNewAgentRoom()}
              >
                {creating ? "만드는 중…" : "+ 새 대화"}
              </Button>
            </div>
            {listError ? <InlineAlert variant="danger">{listError}</InlineAlert> : null}
            {rooms === null ? (
              <LoadingState />
            ) : rooms.length === 0 ? (
              <EmptyState
                title="대화방이 없습니다."
                description="「+ 새 대화」를 누르면 AI기획자와의 대화방이 새 창에서 열립니다."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rooms.map((r) => {
                  const listBusy = roomListBusyId !== null;
                  return (
                    <Card key={r.id} compact>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                          <MessengerRoomListTitleField
                            roomId={r.id}
                            title={r.title}
                            disabled={listBusy}
                            onSaved={loadRooms}
                          />
                          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>
                            {r.lastMessagePreview?.trim() || "메시지 없음"}
                            {r.projectId ? (
                              <button
                                type="button"
                                disabled={listBusy}
                                title="연결된 프로젝트 열기 (새 창)"
                                aria-label="연결된 프로젝트 — 새 창에서 열기"
                                onClick={() => openLinkedProjectWindow(r.projectId!)}
                                style={{
                                  marginLeft: 8,
                                  padding: 0,
                                  border: 0,
                                  background: "transparent",
                                  fontWeight: 800,
                                  color: t.accentTealFg,
                                  cursor: listBusy ? "not-allowed" : "pointer",
                                  opacity: listBusy ? 0.55 : 1,
                                  textDecoration: "underline",
                                  textUnderlineOffset: 2,
                                }}
                              >
                                · 프로젝트 연결됨
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <MessengerRoomListActionButtons
                          disabled={listBusy}
                          showDelete={r.isOwner === true && !r.projectId}
                          onEnter={() => openRoomInWorkModeWindow(r.id)}
                          onLeave={() => void leaveRoomFromList(r.id)}
                          onDelete={() => void deleteRoomFromList(r.id)}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </ResponsivePageContainer>
    </ResponsiveShell>
  );
}
