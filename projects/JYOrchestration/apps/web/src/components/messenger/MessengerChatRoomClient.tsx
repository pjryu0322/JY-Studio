"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { MessengerChatRoomHeaderBar } from "./MessengerChatRoomHeaderBar";
import { MessengerChatRoomProjectDraftModal } from "./MessengerChatRoomProjectDraftModal";
import { MessengerChatRoomRenameModal } from "./MessengerChatRoomRenameModal";
import { MessengerRoomAiSettingsModal } from "./MessengerRoomAiSettingsModal";
import { MessengerProjectLinkedComposerHint } from "./MessengerProjectLinkedComposerHint";
import { MessengerRoomMembersModal } from "./MessengerRoomMembersModal";
import { useMessengerChatRoomData } from "./useMessengerChatRoomData";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import { RequirementsHeader } from "@/components/requirements/RequirementsHeader";
import {
  requirementsIdeationChatPanelShellStyle,
  requirementsWorkspaceMainRowStyle,
  requirementsWorkspaceShellStyle,
} from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { InlineAlert } from "@/components/ui";
import {
  clearMessengerChatRoomConversation,
  deleteMessengerChatRoom,
  patchMessengerRoomAiParticipation,
  patchMessengerRoomTitle,
  postMessengerAiSummaryBlockMessage,
  postMessengerChatRoomLeave,
  postMessengerConfirmProject,
  postMessengerProjectDraft,
  postMessengerUserMessage,
} from "@/lib/messenger/messengerChatRoomApi";
import {
  buildConversationMarkdown,
  confirmResetConversation,
  downloadConversationMarkdownFile,
} from "@/lib/chat/conversationMarkdown";
import { postWorkNoteSummarizeFromHtml } from "@/lib/worknote/workNotesSummarizeApi";
import { messengerMembersToParticipants } from "@/lib/messenger/messengerRoomParticipantMapping";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { textMentionsMessengerAiPlanner, type MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import { buildOptimisticMessengerUserMessage } from "@/lib/messenger/optimisticMessengerMessage";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { openProjectRoomWindow } from "@/lib/ui/workspaceMode";

function messengerDiscardEmptyStorageKey(roomId: string): string {
  return `jyo:messengerDiscardEmpty:${roomId.trim()}`;
}

export function MessengerChatRoomClient({ roomId }: { readonly roomId: string }) {
  const router = useRouter();
  const { mode: workspaceMode } = useWorkspaceMode();
  const rid = roomId.trim();
  const { sessionName, sessionUserId, detail, messages, loadError, reloadDetail, reloadMessages, applyRoomDetail } =
    useMessengerChatRoomData(roomId);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  /** 전송 직후 서버 반영 전까지 표시할 사용자 메시지(기획자 "생각 중"보다 먼저 보이게 함) */
  const [optimisticOutbound, setOptimisticOutbound] = useState<readonly RequirementsMessage[]>([]);
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
  const [resetConversationBusy, setResetConversationBusy] = useState(false);
  const composerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  /** 레일에서 `?discardEmpty=1`로 연 방: 사용자(현재 세션)가 USER 메시지를 보내지 않고 창을 나가면 삭제 */
  const discardEmptyOnCloseRef = useRef(false);
  const userPostedInRoomRef = useRef(false);
  const emptyDiscardSentRef = useRef(false);
  const projectLinkedRef = useRef<string | null>(null);

  const projectLinkedId = detail?.room.projectId ?? null;
  const aiMode = detail?.room.aiParticipationMode ?? "AUTO";

  useEffect(() => {
    setOptimisticOutbound([]);
  }, [rid]);

  useEffect(() => {
    userPostedInRoomRef.current = false;
    emptyDiscardSentRef.current = false;
    discardEmptyOnCloseRef.current = false;
    if (!rid || typeof window === "undefined") return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("discardEmpty") === "1") {
        sessionStorage.setItem(messengerDiscardEmptyStorageKey(rid), "1");
        u.searchParams.delete("discardEmpty");
        window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}`);
      }
    } catch {
      /* noop */
    }
    try {
      if (sessionStorage.getItem(messengerDiscardEmptyStorageKey(rid)) === "1") {
        discardEmptyOnCloseRef.current = true;
      }
    } catch {
      /* noop */
    }
  }, [rid]);

  useEffect(() => {
    projectLinkedRef.current = detail?.room.projectId ?? null;
  }, [detail?.room.projectId]);

  /** 프로젝트 팝업(jyo-idea-*)에서 이 방으로 들어온 경우 window.name을 메신저용으로 바꿔, 프로젝트 이동 시 현재 창이 바뀌지 않게 한다. */
  useEffect(() => {
    if (!rid || typeof window === "undefined") return;
    try {
      if (window.name.startsWith("jyo-idea-")) {
        window.name = `jyo-messenger-chat-${encodeURIComponent(rid)}`;
      }
    } catch {
      /* noop */
    }
  }, [rid]);

  useEffect(() => {
    if (!sessionUserId || !messages || !rid) return;
    const uid = sessionUserId.trim();
    if (!uid) return;
    if (messages.some((m) => m.speakerType === "USER" && m.speakerId === uid)) {
      userPostedInRoomRef.current = true;
      try {
        sessionStorage.removeItem(messengerDiscardEmptyStorageKey(rid));
      } catch {
        /* noop */
      }
    }
  }, [messages, sessionUserId, rid]);

  useEffect(() => {
    if (!rid) return;
    const onPageHide = () => {
      if (!discardEmptyOnCloseRef.current) return;
      if (userPostedInRoomRef.current) return;
      if (projectLinkedRef.current) return;
      if (emptyDiscardSentRef.current) return;
      emptyDiscardSentRef.current = true;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      void fetch(`${origin}/api/chat-rooms/${encodeURIComponent(rid)}`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      });
      try {
        sessionStorage.removeItem(messengerDiscardEmptyStorageKey(rid));
      } catch {
        /* noop */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [rid]);

  const participantOptions = useMemo(() => messengerMembersToParticipants(detail?.members ?? []), [detail?.members]);
  const targetPickerItems = useMemo<readonly RequirementsComposerTargetPickerItem[]>(() => {
    return participantOptions.map((p) => ({
      id: `picker:participant:${p.id}`,
      label: p.name,
      targets: [{ id: p.id, name: p.name }],
    }));
  }, [participantOptions]);

  const displayMessages = useMemo(() => {
    if (!optimisticOutbound.length) return messages;
    const base = messages ?? [];
    return [...base, ...optimisticOutbound];
  }, [messages, optimisticOutbound]);

  const handleComposerSend = useCallback(
    async (_payload: ServiceDesignHarnessPayload) => {
      const text = input.trim();
      if (!rid || !text || busy || aiBusy || Boolean(projectLinkedId)) return;
      const mode = detail?.room.aiParticipationMode ?? "AUTO";
      const expectAiReply =
        mode === "AUTO" || (mode === "MENTION_ONLY" && textMentionsMessengerAiPlanner(text));
      const optimisticUserMessage = buildOptimisticMessengerUserMessage({
        content: text,
        speakerId: sessionUserId ?? undefined,
        speakerName: sessionName,
      });
      setToast(null);
      flushSync(() => {
        setInput("");
        setOptimisticOutbound([optimisticUserMessage]);
      });
      setBusy(true);
      setAiBusy(expectAiReply);
      userPostedInRoomRef.current = true;
      try {
        sessionStorage.removeItem(messengerDiscardEmptyStorageKey(rid));
      } catch {
        /* noop */
      }
      try {
        const { aiError } = await postMessengerUserMessage(rid, text);
        if (aiError) setToast(aiError);
        setOptimisticOutbound([]);
        await reloadMessages();
        await reloadDetail();
      } catch (e) {
        setOptimisticOutbound([]);
        setInput(text);
        setToast(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setAiBusy(false);
        setBusy(false);
      }
    },
    [
      rid,
      input,
      busy,
      aiBusy,
      projectLinkedId,
      detail?.room.aiParticipationMode,
      reloadMessages,
      reloadDetail,
      sessionName,
      sessionUserId,
    ]
  );

  const saveAiSettings = useCallback(
    async (mode: MessengerAiMode) => {
      if (!rid || settingsSaving || projectLinkedId) return;
      setSettingsSaving(true);
      setToast(null);
      try {
        await patchMessengerRoomAiParticipation(rid, mode);
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
      const updated = await patchMessengerRoomTitle(rid, next);
      flushSync(() => {
        applyRoomDetail(updated);
        setRenameInitialTitle(updated.room.title);
        setRenameDraft(updated.room.title);
        setRenameOpen(false);
      });
      void reloadDetail();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setRenameBusy(false);
    }
  }, [rid, renameBusy, renameDraft, reloadDetail, applyRoomDetail]);

  const deleteRoomInView = useCallback(async () => {
    if (!rid || roomLifecycleBusy) return;
    if (!window.confirm("이 대화방과 모든 메시지를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setRoomLifecycleBusy(true);
    setToast(null);
    try {
      await deleteMessengerChatRoom(rid);
      try {
        sessionStorage.removeItem(messengerDiscardEmptyStorageKey(rid));
      } catch {
        /* noop */
      }
      discardEmptyOnCloseRef.current = false;
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
      await postMessengerChatRoomLeave(rid);
      try {
        sessionStorage.removeItem(messengerDiscardEmptyStorageKey(rid));
      } catch {
        /* noop */
      }
      discardEmptyOnCloseRef.current = false;
      router.push("/?panel=chat");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "나가기 오류");
    } finally {
      setRoomLifecycleBusy(false);
    }
  }, [rid, roomLifecycleBusy, router]);

  const onDownloadConversationMarkdown = useCallback(() => {
    const list = messages ?? [];
    if (!list.length) return;
    const roomTitle = (detail?.room.title ?? "").trim() || "대화";
    const md = buildConversationMarkdown({
      heading: `# ${roomTitle} — 대화 내역`,
      scopeLines: [
        `- roomId: ${rid}`,
        detail?.room.projectId ? `- projectId: ${detail.room.projectId}` : "- projectId: (없음)",
        `- exportedAt: ${new Date().toISOString()}`,
      ],
      messages: list,
      meLabel: sessionName.trim() || "나",
    });
    downloadConversationMarkdownFile({ markdown: md, filenameStem: roomTitle });
  }, [detail?.room.projectId, detail?.room.title, messages, rid, sessionName]);

  const onResetConversation = useCallback(async () => {
    if (!rid || resetConversationBusy || busy || aiBusy || roomLifecycleBusy) return;
    if (!confirmResetConversation({ message: "대화 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다." })) {
      return;
    }
    setResetConversationBusy(true);
    setToast(null);
    try {
      await clearMessengerChatRoomConversation(rid);
      setInput("");
      setOptimisticOutbound([]);
      await reloadMessages();
      await reloadDetail();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "대화 초기화 오류");
    } finally {
      setResetConversationBusy(false);
    }
  }, [aiBusy, busy, reloadDetail, reloadMessages, resetConversationBusy, rid, roomLifecycleBusy]);

  const runDraft = useCallback(async () => {
    if (!rid || draftBusy) return;
    setDraftBusy(true);
    setToast(null);
    try {
      const payload = await postMessengerProjectDraft(rid);
      setDraftPayload(payload);
      setProjectName(payload.chosenTitle);
      setProjectDesc(payload.description);
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
      const sn = await postWorkNoteSummarizeFromHtml(contentHtml);
      const meta = [
        `요청 분류 ${sn.requestType}`,
        `우선순위 추천 ${sn.priority}`,
        ...(sn.priorityReason ? [`근거 ${sn.priorityReason}`] : []),
      ].join("\n");
      const block = ["【AI 요약 정리】", "", sn.summary, "", meta].join("\n");
      await postMessengerAiSummaryBlockMessage(rid, block);
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
      const { projectId } = await postMessengerConfirmProject(rid, name, projectDesc.trim() || null);
      setDraftOpen(false);
      const path = appFlowStepHref("requirements", projectId);
      const opened = typeof window !== "undefined" ? openProjectRoomWindow(projectId, workspaceMode, path) : null;
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

  const composerPlaceholder = "메시지를 입력하세요";

  const composer = projectLinkedId ? (
    <MessengerProjectLinkedComposerHint projectId={projectLinkedId} />
  ) : (
    <ServiceDesignComposer
      stage="ideation"
      textAreaRef={composerTextAreaRef}
      value={input}
      onChange={setInput}
      busy={busy || aiBusy || summaryBusy}
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

          <MessengerChatRoomHeaderBar
            detail={detail}
            sessionUserId={sessionUserId}
            participantCount={participantOptions.length}
            messages={messages}
            roomLifecycleBusy={roomLifecycleBusy}
            summaryBusy={summaryBusy}
            busy={busy}
            aiBusy={aiBusy}
            draftBusy={draftBusy}
            onOpenRename={(title) => {
              setRenameInitialTitle(title);
              setRenameDraft(title);
              setRenameError(null);
              setRenameOpen(true);
            }}
            onOpenAiSettings={() => setSettingsOpen(true)}
            onAiSummarize={() => void handleWorkNoteSummarize()}
            onProjectApply={() => void runDraft()}
            onLeave={() => void leaveRoomInView()}
            onDelete={() => void deleteRoomInView()}
            onOpenMembers={() => setMembersModalOpen(true)}
            onResetConversation={() => void onResetConversation()}
            onDownloadConversationMarkdown={() => onDownloadConversationMarkdown()}
            resetConversationBusy={resetConversationBusy}
          />

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
                messages={displayMessages}
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
          onMembershipChanged={() => void reloadDetail()}
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

        <MessengerChatRoomProjectDraftModal
          open={draftOpen}
          payload={draftPayload}
          projectName={projectName}
          projectDesc={projectDesc}
          confirmBusy={confirmBusy}
          onProjectNameChange={setProjectName}
          onProjectDescChange={setProjectDesc}
          onClose={() => setDraftOpen(false)}
          onConfirm={() => void confirmProject()}
        />
      </div>
    </div>
  );
}
