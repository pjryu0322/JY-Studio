"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ResponsivePageContainer, ResponsiveShell } from "@/components/layout";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { Button, Card, EmptyState, InlineAlert, LoadingState, uiTokens as t } from "@/components/ui";
import { MessengerChatRoomRenameModal } from "@/components/messenger/MessengerChatRoomRenameModal";
import { MessengerRoomSettingsGearMenu } from "@/components/messenger/MessengerRoomSettingsGearMenu";
import { MessengerHomeMembersSection } from "@/components/messenger/MessengerHomeMembersSection";
import { parseMessengerHomePanel } from "@/components/messenger/messengerHomePanel";
import { createAndOpenMessengerAgentRoom } from "@/lib/messenger/createAndOpenMessengerAgentRoom";
import {
  deleteMessengerChatRoom,
  fetchMessengerChatRooms,
  patchMessengerRoomTitle,
  postMessengerChatRoomLeave,
  type MessengerChatRoomListRow,
} from "@/lib/messenger/messengerChatRoomApi";
import { openMessengerChatRoomWindow } from "@/lib/messenger/openMessengerChatRoomWindow";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";

export function MessengerHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveLayout } = useWorkspaceMode();
  const panel = parseMessengerHomePanel(searchParams.get("panel"));

  const [rooms, setRooms] = useState<MessengerChatRoomListRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameInitialTitle, setRenameInitialTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
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
      await patchMessengerRoomTitle(renameRoomId, next);
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
        await deleteMessengerChatRoom(roomId);
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
        await postMessengerChatRoomLeave(roomId);
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
                {rooms.map((r) => (
                  <Card key={r.id} compact>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <a
                          href={`/chat/${encodeURIComponent(r.id)}`}
                          rel="noopener noreferrer"
                          title="새 창에서 대화방 열기"
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            const opened = openMessengerChatRoomWindow(r.id, { effectiveLayout });
                            if (!opened) {
                              const path = `/chat/${encodeURIComponent(r.id)}`;
                              const w = window.open(path, "_blank", "noopener,noreferrer");
                              registerPlatformPopupFromOpenedUrl(w, path);
                            }
                          }}
                          style={{
                            display: "block",
                            textDecoration: "none",
                            color: "inherit",
                            cursor: "pointer",
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>{r.title}</div>
                        </a>
                        <Link
                          href={`/chat/${encodeURIComponent(r.id)}`}
                          style={{ display: "block", textDecoration: "none", color: "inherit" }}
                        >
                          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>
                            {r.lastMessagePreview?.trim() || "메시지 없음"}
                            {r.projectId ? (
                              <span style={{ marginLeft: 8, fontWeight: 800, color: t.accentTealFg }}>· 프로젝트 연결됨</span>
                            ) : null}
                          </div>
                        </Link>
                      </div>
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
