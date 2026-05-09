"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { MessengerChatRoomRenameModal, MessengerRoomSettingsGearMenu } from "./MessengerChatRoomRenameModal";
import { MessengerRoomAiSettingsModal } from "./MessengerRoomAiSettingsModal";
import { MessengerRoomMembersModal } from "./MessengerRoomMembersModal";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import {
  requirementsIdeationChatPanelShellStyle,
  requirementsWorkspaceMainRowStyle,
  requirementsWorkspaceShellStyle,
} from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { Button, InlineAlert, uiTokens as t } from "@/components/ui";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { WORKSPACE_AI_MEMBER_KEYS, getWorkspaceAiMember, type WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { sessionUserFromAuthMe, type AuthMeDataWire } from "@/lib/user/platformProfile";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import {
  messengerAiModeShortLabel,
  parseMessengerAiMode,
  textMentionsMessengerAiPlanner,
  type MessengerAiMode,
} from "@/lib/messenger/messengerAiParticipation";

type ChatRoomMemberWire = {
  readonly id: string;
  readonly memberType: "USER" | "AI";
  readonly userId: string | null;
  readonly aiMemberId: string | null;
  readonly displayName: string;
  readonly role: string | null;
};

type RoomDetail = {
  readonly room: {
    id: string;
    title: string;
    ownerUserId: string;
    projectId: string | null;
    aiParticipationMode: MessengerAiMode;
    /** Prisma `ChatRoomType` — GROUP이면 친구 Chat 등 */
    type: string;
  };
  readonly members: readonly ChatRoomMemberWire[];
};

function parseWorkspaceAiMemberId(raw: string | null | undefined): WorkspaceAiMemberId | undefined {
  const s = String(raw ?? "").trim();
  return (WORKSPACE_AI_MEMBER_KEYS as readonly string[]).includes(s) ? (s as WorkspaceAiMemberId) : undefined;
}

function messengerMembersToParticipants(members: readonly ChatRoomMemberWire[]): readonly ParticipantOption[] {
  const out: ParticipantOption[] = [];
  for (const m of members) {
    if (m.memberType === "USER") {
      out.push({
        id: `human:${m.userId ?? m.id}`,
        name: m.displayName.trim() || "나",
        kind: "human",
        onlineHint: true,
        roleLabel: m.role?.trim() || undefined,
      });
      continue;
    }
    if (m.memberType === "AI") {
      const wid = parseWorkspaceAiMemberId(m.aiMemberId);
      const def = wid ? getWorkspaceAiMember(wid) : undefined;
      out.push({
        id: `ai:${m.aiMemberId ?? m.id}`,
        name: m.displayName.trim() || def?.title || "AI",
        kind: "ai",
        onlineHint: false,
        platformMemberId: wid,
        isCurrentScreenAi: Boolean(wid),
        aiAvatarGlyphKey: def?.avatarGlyphKey,
        aiAvatarAccent: def?.avatarAccent,
        aiAvatarLabel: def?.avatarLabel,
        roleLabel: m.role?.trim() || undefined,
      });
    }
  }
  return out;
}

function ChromeIconButton({
  title,
  ariaLabel,
  disabled,
  badge,
  onClick,
  children,
}: {
  readonly title: string;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly badge?: number | null;
  readonly onClick: () => void | Promise<void>;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onClick();
      }}
      style={{
        position: "relative",
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: disabled ? "#f8fafc" : "#fff",
        color: disabled ? t.textMuted : "#0f172a",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 ? (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "#0ea5e9",
            color: "#fff",
            fontSize: 10,
            fontWeight: 900,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid #fff",
            lineHeight: 1,
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function MessengerChatRoomClient({ roomId }: { readonly roomId: string }) {
  const router = useRouter();
  const rid = roomId.trim();
  const [sessionName, setSessionName] = useState("나");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<readonly RequirementsMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftPayload, setDraftPayload] = useState<ProjectFromChatDraftPayloadV1 | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameInitialTitle, setRenameInitialTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [roomLifecycleBusy, setRoomLifecycleBusy] = useState(false);
  const composerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const reloadMessages = useCallback(async () => {
    if (!rid) return;
    const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/messages`);
    const json = (await res.json()) as { success?: boolean; data?: { messages?: RequirementsMessage[] }; message?: string };
    if (!res.ok || !json.success || !Array.isArray(json.data?.messages)) {
      throw new Error(json.message || "메시지를 불러오지 못했습니다.");
    }
    setMessages(json.data!.messages!);
  }, [rid]);

  const reloadDetail = useCallback(async () => {
    if (!rid) return;
    const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}`);
    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        room?: {
          id: string;
          title: string;
          ownerUserId?: string;
          projectId: string | null;
          aiParticipationMode?: string;
          type?: string;
        };
        members?: ChatRoomMemberWire[];
      };
      message?: string;
    };
    if (!res.ok || !json.success || !json.data?.room) {
      throw new Error(json.message || "대화방을 불러오지 못했습니다.");
    }
    const row = json.data.room;
    const mode = parseMessengerAiMode(row.aiParticipationMode) ?? "AUTO";
    const roomType = typeof row.type === "string" && row.type.trim() ? row.type.trim() : "SOLO";
    const ownerUserId = typeof row.ownerUserId === "string" && row.ownerUserId.trim() ? row.ownerUserId.trim() : "";
    const members = Array.isArray(json.data.members) ? json.data.members : [];
    setDetail({
      room: {
        id: row.id,
        title: row.title,
        ownerUserId,
        projectId: row.projectId ?? null,
        aiParticipationMode: mode,
        type: roomType,
      },
      members,
    });
  }, [rid]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: AuthMeDataWire | null };
        if (res.ok && json.success && json.data) {
          const u = sessionUserFromAuthMe(json.data);
          setSessionUserId(u.id || null);
          setSessionName(u.name || "나");
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!rid) {
      setLoadError("대화방 ID가 없습니다.");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      setMessages(null);
      try {
        await reloadDetail();
        await reloadMessages();
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "불러오기 실패");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rid, reloadDetail, reloadMessages]);

  const title = detail?.room.title ?? "대화";
  const projectLinkedId = detail?.room.projectId ?? null;
  const aiMode = detail?.room.aiParticipationMode ?? "AUTO";
  const roomType = detail?.room.type ?? "SOLO";
  const isGroupFriendChat = roomType === "GROUP" && aiMode === "NONE";
  const isRoomOwner = Boolean(sessionUserId && detail?.room.ownerUserId && detail.room.ownerUserId === sessionUserId);
  const showRoomDelete = isRoomOwner && !projectLinkedId;
  const showRoomLeave = Boolean(sessionUserId && detail);
  const participantOptions = useMemo(() => messengerMembersToParticipants(detail?.members ?? []), [detail?.members]);
  const targetPickerItems = useMemo<readonly RequirementsComposerTargetPickerItem[]>(() => {
    return participantOptions.map((p) => ({
      id: `picker:participant:${p.id}`,
      label: p.name,
      targets: [{ id: p.id, name: p.name }],
    }));
  }, [participantOptions]);

  const handleComposerSend = useCallback(
    async (_payload: ServiceDesignHarnessPayload) => {
      const text = input.trim();
      if (!rid || !text || busy || aiBusy || Boolean(projectLinkedId)) return;
      const mode = detail?.room.aiParticipationMode ?? "AUTO";
      const expectAiReply =
        mode === "AUTO" || (mode === "MENTION_ONLY" && textMentionsMessengerAiPlanner(text));
      setBusy(true);
      setAiBusy(expectAiReply);
      setToast(null);
      try {
        flushSync(() => {
          setInput("");
        });
        const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { aiRan?: boolean; aiError?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(json.message || "전송에 실패했습니다.");
        }
        if (json.data?.aiError) {
          setToast(json.data.aiError);
        }
        await reloadMessages();
        await reloadDetail();
      } catch (e) {
        setToast(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setAiBusy(false);
        setBusy(false);
      }
    },
    [rid, input, busy, aiBusy, projectLinkedId, detail?.room.aiParticipationMode, reloadMessages, reloadDetail]
  );

  const saveAiSettings = useCallback(
    async (mode: MessengerAiMode) => {
      if (!rid || settingsSaving || projectLinkedId) return;
      setSettingsSaving(true);
      setToast(null);
      try {
        const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiParticipationMode: mode }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.message || "설정을 저장하지 못했습니다.");
        }
        await reloadDetail();
        await reloadMessages();
      } catch (e) {
        setToast(e instanceof Error ? e.message : "설정 저장 오류");
      } finally {
        setSettingsSaving(false);
      }
    },
    [rid, settingsSaving, projectLinkedId, reloadDetail, reloadMessages]
  );

  const saveRoomTitle = useCallback(async () => {
    if (!rid || renameBusy) return;
    const next = renameDraft.trim();
    if (!next) {
      setRenameError("제목을 입력해 주세요.");
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      setRenameOpen(false);
      await reloadDetail();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setRenameBusy(false);
    }
  }, [rid, renameBusy, renameDraft, reloadDetail]);

  const deleteRoomInView = useCallback(async () => {
    if (!rid || roomLifecycleBusy) return;
    if (!window.confirm("이 대화방과 모든 메시지를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setRoomLifecycleBusy(true);
    setToast(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}`, { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) throw new Error(json.message || "삭제에 실패했습니다.");
      router.push("/?panel=chat");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "삭제 오류");
    } finally {
      setRoomLifecycleBusy(false);
    }
  }, [rid, roomLifecycleBusy, router]);

  const leaveRoomInView = useCallback(async () => {
    if (!rid || roomLifecycleBusy) return;
    if (!window.confirm("이 대화방에서 나가시겠습니까? 목록에서 사라집니다.")) return;
    setRoomLifecycleBusy(true);
    setToast(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/leave`, { method: "POST" });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) throw new Error(json.message || "나가기에 실패했습니다.");
      router.push("/?panel=chat");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "나가기 오류");
    } finally {
      setRoomLifecycleBusy(false);
    }
  }, [rid, roomLifecycleBusy, router]);

  const runDraft = useCallback(async () => {
    if (!rid || draftBusy) return;
    setDraftBusy(true);
    setToast(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/project-draft`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { payload?: ProjectFromChatDraftPayloadV1 };
        message?: string;
      };
      if (!res.ok || !json.success || !json.data?.payload) {
        throw new Error(json.message || "초안 생성에 실패했습니다.");
      }
      setDraftPayload(json.data.payload);
      setProjectName(json.data.payload.chosenTitle);
      setProjectDesc(json.data.payload.description);
      setDraftOpen(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "초안 생성 오류");
    } finally {
      setDraftBusy(false);
    }
  }, [rid, draftBusy]);

  const handleWorkNoteSummarize = useCallback(async () => {
    if (!rid || summaryBusy || busy || aiBusy) return;
    const list = messages ?? [];
    const hasBody = list.some((m) => String(m.content ?? "").trim());
    if (!hasBody) {
      setToast("요약할 대화 내용이 없습니다.");
      return;
    }
    setSummaryBusy(true);
    setToast(null);
    try {
      const contentHtml = buildConversationContentHtmlForWorkNoteSummary(list, sessionName, { maxMessages: 80 });
      const res = await credentialsIncludeFetch("/api/work-notes/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "user",
          contentHtml,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { summary?: string; requestType?: string; priority?: string; priorityReason?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }
      const summary = typeof json.data?.summary === "string" ? json.data.summary.trim() : "";
      if (!summary) throw new Error("요약 결과가 비어 있습니다.");
      const requestType = typeof json.data?.requestType === "string" ? json.data.requestType.trim() || "기타" : "기타";
      const priority = typeof json.data?.priority === "string" ? json.data.priority.trim().toUpperCase() || "P2" : "P2";
      const priorityReason =
        typeof json.data?.priorityReason === "string" && json.data.priorityReason.trim()
          ? json.data.priorityReason.trim()
          : "";
      const meta = [`요청 분류 ${requestType}`, `우선순위 추천 ${priority}`, ...(priorityReason ? [`근거 ${priorityReason}`] : [])].join("\n");
      const block = ["【AI 요약 정리】", "", summary, "", meta].join("\n");
      const post = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: block, kind: "ai_work_note_summary" }),
      });
      const postJson = (await post.json()) as { success?: boolean; message?: string };
      if (!post.ok || !postJson.success) {
        throw new Error(postJson.message || "요약을 대화에 저장하지 못했습니다.");
      }
      await reloadMessages();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "AI 요약에 실패했습니다.");
    } finally {
      setSummaryBusy(false);
    }
  }, [rid, summaryBusy, busy, aiBusy, messages, sessionName, reloadMessages]);

  const confirmProject = useCallback(async () => {
    if (!rid || confirmBusy) return;
    const name = projectName.trim();
    if (!name) {
      setToast("프로젝트 이름을 입력해 주세요.");
      return;
    }
    setConfirmBusy(true);
    setToast(null);
    try {
      const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/confirm-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: projectDesc.trim() || null }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { projectId?: string }; message?: string };
      if (!res.ok || !json.success || !json.data?.projectId) {
        throw new Error(json.message || "프로젝트 생성에 실패했습니다.");
      }
      setDraftOpen(false);
      const path = appFlowStepHref("requirements", json.data.projectId);
      const url = typeof window !== "undefined" ? new URL(path, window.location.origin).href : path;
      const opened = typeof window !== "undefined" ? window.open(url, "_blank", "noopener,noreferrer") : null;
      if (!opened) {
        setToast(
          "프로젝트는 만들어졌습니다. 새 탭이 차단되어 서비스 기획 화면이 열리지 않았습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤, 상단의 프로젝트 연결 안내 링크로 이동할 수 있습니다."
        );
      }
      await reloadDetail();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "프로젝트 생성 오류");
    } finally {
      setConfirmBusy(false);
    }
  }, [rid, confirmBusy, projectName, projectDesc, reloadDetail]);

  const composerPlaceholder = projectLinkedId
    ? "프로젝트에 연결된 대화방입니다. 요구사항 화면에서 계속하세요."
    : "메시지를 입력하세요";

  const hasChatBody = Boolean((messages ?? []).some((m) => String(m.content ?? "").trim()));

  const composer = (
    <ServiceDesignComposer
      stage="ideation"
      textAreaRef={composerTextAreaRef}
      value={input}
      onChange={setInput}
      busy={busy || aiBusy || summaryBusy}
      disabled={Boolean(projectLinkedId)}
      placeholder={composerPlaceholder}
      targetPickerItems={targetPickerItems}
      onSendIdeation={handleComposerSend}
      onSendServiceFlow={handleComposerSend}
      onSendFeaturePlanning={handleComposerSend}
    />
  );

  if (!rid) {
    return (
      <div className="jyo-requirements-page-shell">
        <InlineAlert variant="danger">잘못된 경로입니다.</InlineAlert>
      </div>
    );
  }

  return (
    <div className="jyo-requirements-page-shell">
      <div style={requirementsWorkspaceShellStyle}>
        <div className="jyo-requirements-workspace-top-chrome">
          <RequirementsHeader showProjectWorkflowNav={false} />

          {projectLinkedId ? (
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 8, lineHeight: 1.45 }}>
              프로젝트룸에 연결된 대화입니다.{" "}
              <Link href={appFlowStepHref("requirements", projectLinkedId)} style={{ color: "#2563eb", fontWeight: 700 }}>
                요구사항(SingleChat)으로 계속하기 →
              </Link>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {title}
              </div>
              <MessengerRoomSettingsGearMenu
                disabled={roomLifecycleBusy}
                showRename
                showAiSettings={!projectLinkedId}
                showAiSummarize
                showProjectApply={!projectLinkedId}
                aiSummarizeDisabled={summaryBusy || busy || aiBusy || messages === null || !hasChatBody}
                projectApplyDisabled={draftBusy || busy || aiBusy || summaryBusy}
                showLeave={showRoomLeave}
                showDelete={showRoomDelete}
                onRename={() => {
                  setRenameInitialTitle(title);
                  setRenameDraft(title);
                  setRenameError(null);
                  setRenameOpen(true);
                }}
                onAiSettings={() => setSettingsOpen(true)}
                onAiSummarize={() => void handleWorkNoteSummarize()}
                onProjectApply={() => void runDraft()}
                onLeave={() => void leaveRoomInView()}
                onDelete={() => void deleteRoomInView()}
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
              <ChromeIconButton
                title="참여 멤버"
                ariaLabel="참여 멤버 및 초대"
                disabled={roomLifecycleBusy}
                badge={participantOptions.length > 0 ? participantOptions.length : undefined}
                onClick={() => setMembersModalOpen(true)}
              >
                <UsersIcon />
              </ChromeIconButton>
            </div>
          </div>

          {loadError ? (
            <div style={{ marginBottom: 8 }}>
              <InlineAlert variant="danger">{loadError}</InlineAlert>
            </div>
          ) : null}
          {toast ? (
            <div style={{ marginBottom: 8 }}>
              <InlineAlert variant="danger">{toast}</InlineAlert>
            </div>
          ) : null}
        </div>

        <div className="jyo-requirements-workspace-body">
          <div style={requirementsWorkspaceMainRowStyle} className="jyo-requirements-workspace-main">
            <div style={requirementsIdeationChatPanelShellStyle}>
              <RequirementsChatPanel
                messages={messages}
                typingIndicator={aiBusy}
                screenAiMemberId="ideation"
                sessionUserDisplayName={sessionName}
                composer={composer}
              />
            </div>
          </div>
        </div>

        <MessengerRoomMembersModal
          open={membersModalOpen}
          onClose={() => setMembersModalOpen(false)}
          roomId={rid}
          participants={participantOptions}
          aiParticipationMode={aiMode}
        />

        <MessengerRoomAiSettingsModal
          open={settingsOpen}
          onClose={() => !settingsSaving && setSettingsOpen(false)}
          currentMode={aiMode}
          saving={settingsSaving}
          disabled={Boolean(projectLinkedId)}
          onSave={(mode) => void saveAiSettings(mode)}
        />

        <MessengerChatRoomRenameModal
          open={renameOpen}
          initialTitle={renameInitialTitle}
          value={renameDraft}
          onChange={setRenameDraft}
          onClose={() => !renameBusy && setRenameOpen(false)}
          onSave={() => void saveRoomTitle()}
          saving={renameBusy}
          error={renameError}
        />

        {draftOpen && draftPayload ? (
          <div
            role="dialog"
            aria-label="프로젝트 초안"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              background: t.overlayScrim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onMouseDown={() => {
              if (!confirmBusy) setDraftOpen(false);
            }}
          >
            <div
              style={{
                width: "min(96vw, 560px)",
                maxHeight: "min(88vh, 720px)",
                overflowY: "auto",
                borderRadius: t.radiusLg,
                background: t.bgCard,
                border: `1px solid ${t.border}`,
                padding: 16,
                boxSizing: "border-box",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>프로젝트 초안</div>
              <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, margin: "10px 0 14px" }}>
                제목 후보: {draftPayload.titleCandidates.join(" · ")}
              </p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>프로젝트 이름</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: t.radiusMd,
                  border: `1px solid ${t.borderStrong}`,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>설명</label>
              <textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  marginBottom: 14,
                  padding: 10,
                  borderRadius: t.radiusMd,
                  border: `1px solid ${t.borderStrong}`,
                  fontSize: 13,
                  lineHeight: 1.45,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" size="md" disabled={confirmBusy} onClick={() => setDraftOpen(false)}>
                  취소
                </Button>
                <Button type="button" variant="primary" size="md" loading={confirmBusy} disabled={confirmBusy} onClick={() => void confirmProject()}>
                  프로젝트룸 만들기
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
