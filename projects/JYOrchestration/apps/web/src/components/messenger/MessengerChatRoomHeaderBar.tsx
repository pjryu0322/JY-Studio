"use client";

import { MessengerRoomSettingsGearMenu } from "./MessengerRoomSettingsGearMenu";
import { WorkspaceHubChromeIconButton, WorkspaceHubUsersIcon } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { messengerAiModeShortLabel } from "@/lib/messenger/messengerAiParticipation";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import type { MessengerRoomDetail } from "@/lib/messenger/messengerRoomParticipantMapping";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { openProjectRoomWindow } from "@/lib/ui/workspaceMode";

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
}) {
  const { mode: workspaceMode } = useWorkspaceMode();
  const title = p.detail?.room.title ?? "대화";
  const projectLinkedId = p.detail?.room.projectId ?? null;
  const aiMode: MessengerAiMode = p.detail?.room.aiParticipationMode ?? "AUTO";
  const roomType = p.detail?.room.type ?? "SOLO";
  const isGroupFriendChat = roomType === "GROUP" && aiMode === "NONE";
  const isRoomOwner = Boolean(p.sessionUserId && p.detail?.room.ownerUserId && p.detail.room.ownerUserId === p.sessionUserId);
  const showRoomDelete = isRoomOwner && !projectLinkedId;
  const showRoomLeave = Boolean(p.sessionUserId && p.detail);

  const hasChatBody = Boolean((p.messages ?? []).some((m) => String(m.content ?? "").trim()));

  const projectRequirementsHref = projectLinkedId ? appFlowStepHref("requirements", projectLinkedId) : null;
  const projectLinkTooltip =
    "프로젝트룸에 연결된 대화입니다. 요구사항(SingleChat)으로 계속하기";

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
          {projectRequirementsHref && projectLinkedId ? (
            <a
              href={projectRequirementsHref}
              title={projectLinkTooltip}
              aria-label={projectLinkTooltip}
              onClick={(e) => {
                if (e.defaultPrevented) return;
                if (e.button !== 0) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                openProjectRoomWindow(projectLinkedId, workspaceMode, projectRequirementsHref);
              }}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 10,
                border: "1px solid #bae6fd",
                background: "#f0f9ff",
                color: "#0369a1",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 13a5 5 0 0 0 7.54.54l1.41-1.41a5 5 0 0 0-7.07-7.07L9.88 6.88" />
                <path d="M14 11a5 5 0 0 0-7.54-.54L5.05 11.95a5 5 0 0 0 7.07 7.07l.71-.71" />
              </svg>
            </a>
          ) : null}
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
