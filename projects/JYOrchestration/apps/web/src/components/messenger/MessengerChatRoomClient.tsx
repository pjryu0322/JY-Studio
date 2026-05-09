"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import { MessengerChatRoomHeaderBar } from "./MessengerChatRoomHeaderBar";
import { MessengerChatRoomProjectDraftModal } from "./MessengerChatRoomProjectDraftModal";
import { MessengerChatRoomRenameModal } from "./MessengerChatRoomRenameModal";
import { MessengerRoomAiSettingsModal } from "./MessengerRoomAiSettingsModal";
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
import { messengerMembersToParticipants } from "@/lib/messenger/messengerRoomParticipantMapping";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { buildConversationContentHtmlForWorkNoteSummary } from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { textMentionsMessengerAiPlanner, type MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";

export function MessengerChatRoomClient({ roomId }: { readonly roomId: string }) {
  const router = useRouter();
  const rid = roomId.trim();
  const { sessionName, sessionUserId, detail, messages, loadError, reloadDetail, reloadMessages } =
    useMessengerChatRoomData(roomId);

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

  const projectLinkedId = detail?.room.projectId ?? null;
  const aiMode = detail?.room.aiParticipationMode ?? "AUTO";

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
