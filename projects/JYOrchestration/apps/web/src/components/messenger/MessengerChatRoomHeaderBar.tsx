"use client";

import { MessengerRoomSettingsGearMenu } from "./MessengerRoomSettingsGearMenu";
import { PromptTimelinePanelButton } from "@/components/debug/PromptTimelineDebugButton";
import { ConversationChromeToolbar } from "@/components/workspace/ConversationChromeToolbar";
import { WorkspaceHubChromeIconButton, WorkspaceHubUsersIcon } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";
import { messengerAiModeShortLabel } from "@/lib/messenger/messengerAiParticipation";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import type { MessengerRoomDetail } from "@/lib/messenger/messengerRoomParticipantMapping";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function MessengerChatRoomHeaderBar(p: {
  readonly detail: MessengerRoomDetail | null;
  readonly sessionUserId: string | null;
  readonly participantCount: number;
  readonly messages: readonly RequirementsMessage[] | null;
  readonly roomLifecycleBusy: boolean;
  readonly summaryBusy: boolean;
  readonly busy: boolean;
  readonly aiBusy: boolean;
  readonly draftBusy: boolean;
  readonly onOpenRename: (title: string) => void;
  readonly onOpenAiSettings: () => void;
  readonly onAiSummarize: () => void;
  readonly onProjectApply: () => void;
  readonly onLeave: () => void;
  readonly onDelete: () => void;
  readonly onOpenMembers: () => void;
  readonly onResetConversation: () => void;
  readonly onDownloadConversationMarkdown: () => void;
  readonly resetConversationBusy: boolean;
}) {
  const title = p.detail?.room.title ?? "대화";
  const roomId = p.detail?.room.id ?? null;
  const projectLinkedId = p.detail?.room.projectId ?? null;
  const showPromptTimeline = isPromptTimelineDebugClient() && Boolean(roomId);
  const aiMode: MessengerAiMode = p.detail?.room.aiParticipationMode ?? "AUTO";
  const roomType = p.detail?.room.type ?? "SOLO";
  const isGroupFriendChat = roomType === "GROUP" && aiMode === "NONE";
  const isRoomOwner = Boolean(p.sessionUserId && p.detail?.room.ownerUserId && p.detail.room.ownerUserId === p.sessionUserId);
  const showRoomDelete = isRoomOwner && !projectLinkedId;
  const showRoomLeave = Boolean(p.sessionUserId && p.detail);

  const hasChatBody = Boolean((p.messages ?? []).some((m) => String(m.content ?? "").trim()));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {title}
          </div>
          {showPromptTimeline ? (
            <PromptTimelinePanelButton
              projectId={projectLinkedId}
              roomId={roomId}
              disabled={p.roomLifecycleBusy}
              emptyHint={
                projectLinkedId
                  ? "아직 기록된 호출이 없습니다. 이 프로젝트의 요구사항·메신저 AI 호출이 여기에 쌓입니다."
                  : "아직 기록된 호출이 없습니다. 이 대화방에서 AI 기획자와 대화하면 OpenAI 호출 기록이 여기에 쌓입니다."
              }
            />
          ) : null}
          <ConversationChromeToolbar
            onResetConversation={p.onResetConversation}
            onDownloadConversationMarkdown={p.onDownloadConversationMarkdown}
            resetDisabled={
              p.roomLifecycleBusy ||
              p.resetConversationBusy ||
              p.busy ||
              p.aiBusy ||
              p.messages === null ||
              !hasChatBody
            }
            downloadDisabled={p.roomLifecycleBusy || p.messages === null || !hasChatBody}
          />
          <MessengerRoomSettingsGearMenu
            disabled={p.roomLifecycleBusy}
            showRename
            showAiSettings={!projectLinkedId}
            showAiSummarize
            showProjectApply={!projectLinkedId}
            aiSummarizeDisabled={p.summaryBusy || p.busy || p.aiBusy || p.messages === null || !hasChatBody}
            projectApplyDisabled={p.draftBusy || p.busy || p.aiBusy || p.summaryBusy}
            showLeave={showRoomLeave}
            showDelete={showRoomDelete}
            onRename={() => p.onOpenRename(title)}
            onAiSettings={p.onOpenAiSettings}
            onAiSummarize={p.onAiSummarize}
            onProjectApply={p.onProjectApply}
            onLeave={p.onLeave}
            onDelete={p.onDelete}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0f766e",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              padding: "4px 10px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {isGroupFriendChat ? "Chat" : messengerAiModeShortLabel(aiMode)}
          </span>
          <WorkspaceHubChromeIconButton
            title="참여 멤버"
            ariaLabel="참여 멤버 및 초대"
            disabled={p.roomLifecycleBusy}
            badge={p.participantCount > 0 ? p.participantCount : undefined}
            onClick={p.onOpenMembers}
          >
            <WorkspaceHubUsersIcon />
          </WorkspaceHubChromeIconButton>
        </div>
      </div>
    </>
  );
}
