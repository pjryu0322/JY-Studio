"use client";

import { useMemo, type RefObject, type ReactNode } from "react";
import type { IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { requirementsIdeationChatPanelShellStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { ImplementationPrepProgressCard } from "@/components/requirements/ImplementationPrepProgressCard";

export type RequirementsIdeationChatPanelProps = Readonly<{
  showScreenLabels: boolean;
  conversationStatus: "idle" | "loading" | "loaded" | "error";
  /** 통합 타임라인(`requirementsConversation.messages` 전체) */
  chatMessages: readonly RequirementsMessage[];
  participantAiMemberId: WorkspaceAiMemberId;
  aiInvokePending: boolean;
  /** service-flow analyze API 대기(통합 채팅 typing/busy 연동) */
  serviceFlowAnalyzePending?: boolean;
  serviceFlowPendingStatusLabel?: string | null;
  /** Quick Design 확정 등 장시간 기획 액션 대기 */
  quickDesignConfirmPending?: boolean;
  /** SingleChat 입력·하네스 라우팅용 내부 단계 */
  serviceDesignStage: RequirementsWorkspaceStage;
  /** 채팅 헤더 참가자 배지(통합 화면에서는 항상 전달 권장) */
  memberControls?: { count: number; onOpen: () => void } | null;
  onInsertComposerPrompt: (text: string) => void;
  /** 인터뷰 추천 칩 — 탭 시 입력창 프리필(또는 직접 입력 유도) */
  onInterviewSuggestionPick?: (label: string) => void;
  onSetReplyTo: (messageId: string, preview: string) => void;
  openDeliverableDocument: (id: string) => void;
  openDeliverableList: (focusId: string | null) => void;
  openDeliverableDocuments: (ids: readonly string[]) => void;
  onRegenerateDeliverables: (types: readonly IdeationDeliverableType[]) => void;
  onConfirmDeliverables: (ids: readonly string[]) => void;
  replyTo: { id: string; preview: string } | null;
  onClearReplyTo: () => void;
  composerTextAreaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInputChange: (value: string) => void;
  onSendIdeation: (payload: ServiceDesignHarnessPayload) => void | Promise<void>;
  busy: boolean;
  composerPlaceholder: string;
  targetPickerItems: readonly RequirementsComposerTargetPickerItem[];
  typingIndicatorSpeakerLine?: string | null;
  typingIndicatorResolvedSpeakerSource?: string | null;
  /** 채팅 내 내 메시지 표시명(세션 닉네임) */
  sessionUserDisplayName?: string;
  onOrganizeRequirements: () => void | Promise<void>;
  organizeDisabled: boolean;
  draftDocTruthy: boolean;
  onOpenDraftView: () => void;
  /** + 메뉴(ideation 정리 + Artifact 생성) */
  plusMenuRender?: (ctx: { readonly close: () => void }) => ReactNode;
  /** H7.5: explainability 보조 매핑용 */
  promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  onOpenPromptTimeline?: () => void;
  /** 기획단계 구현준비 확인 카드 */
  chatHeaderLeading?: ReactNode;
}>;

export function RequirementsIdeationChatPanel({
  showScreenLabels,
  conversationStatus,
  chatMessages,
  participantAiMemberId,
  aiInvokePending,
  serviceFlowAnalyzePending = false,
  serviceFlowPendingStatusLabel = null,
  quickDesignConfirmPending = false,
  serviceDesignStage,
  memberControls,
  onInsertComposerPrompt,
  onInterviewSuggestionPick,
  onSetReplyTo,
  openDeliverableDocument,
  openDeliverableList,
  openDeliverableDocuments,
  onRegenerateDeliverables,
  onConfirmDeliverables,
  replyTo,
  onClearReplyTo,
  composerTextAreaRef,
  input,
  onInputChange,
  onSendIdeation,
  busy,
  composerPlaceholder,
  targetPickerItems,
  typingIndicatorSpeakerLine,
  typingIndicatorResolvedSpeakerSource,
  sessionUserDisplayName,
  onOrganizeRequirements,
  organizeDisabled,
  draftDocTruthy,
  onOpenDraftView,
  plusMenuRender,
  promptTimeline,
  onOpenPromptTimeline,
  chatHeaderLeading,
}: RequirementsIdeationChatPanelProps) {
  const showTypingIndicator = useMemo(() => {
    const pending = aiInvokePending || serviceFlowAnalyzePending || quickDesignConfirmPending;
    if (!pending) return false;
    if (quickDesignConfirmPending) return true;
    if (!chatMessages.length) return true;
    const last = chatMessages[chatMessages.length - 1];
    return last?.role !== "ai";
  }, [aiInvokePending, quickDesignConfirmPending, serviceFlowAnalyzePending, chatMessages]);

  const composer: ReactNode = (
    <>
      {replyTo ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "#475569",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontWeight: 700, color: "#0f172a" }} title={replyTo.preview || replyTo.id}>
              {replyTo.preview || "답글 작성 중"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearReplyTo}
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 800,
              color: "#475569",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            취소 ×
          </button>
        </div>
      ) : null}
      <ServiceDesignComposer
        stage={serviceDesignStage}
        textAreaRef={composerTextAreaRef}
        value={input}
        onChange={onInputChange}
        busy={busy || aiInvokePending || serviceFlowAnalyzePending || quickDesignConfirmPending}
        disabled={false}
        placeholder={composerPlaceholder}
        targetPickerItems={targetPickerItems}
        onSendIdeation={onSendIdeation}
        onSendServiceFlow={onSendIdeation}
        onSendFeaturePlanning={onSendIdeation}
        plusMenuRender={plusMenuRender}
        ideationToolsMenu={
          plusMenuRender
            ? undefined
            : {
                onOrganizeRequirements: () => void onOrganizeRequirements(),
                organizeDisabled,
                draftViewAvailable: draftDocTruthy,
                onOpenDraftView,
              }
        }
      />
    </>
  );

  return (
    <div className="jyo-requirements-chat-panel-shell" style={requirementsIdeationChatPanelShellStyle}>
      <ScreenLabel label="요구사항-채팅영역-대화이력복원" visible={showScreenLabels} />
      <RequirementsChatPanel
        messages={conversationStatus === "loaded" ? chatMessages : null}
        screenAiMemberId={participantAiMemberId}
        headerLeading={chatHeaderLeading ?? null}
        typingIndicator={showTypingIndicator}
        typingIndicatorSpeakerLine={
          quickDesignConfirmPending
            ? "구현준비 생성 중 — CodeTask LLM 정제를 Batch 기준으로 처리하고 있습니다…"
            : serviceFlowAnalyzePending
              ? String(serviceFlowPendingStatusLabel ?? "").trim() ||
                "AI 기획자가 응답을 준비하고 있습니다…"
              : typingIndicatorSpeakerLine
        }
        typingIndicatorResolvedSpeakerSource={
          quickDesignConfirmPending
            ? "quick-design-confirm"
            : serviceFlowAnalyzePending
              ? "service-flow-analyze"
              : typingIndicatorResolvedSpeakerSource
        }
        interviewSuggestionPickDisabled={quickDesignConfirmPending}
        sessionUserDisplayName={sessionUserDisplayName}
        memberControls={memberControls}
        promptTimeline={promptTimeline}
        onOpenPromptTimeline={onOpenPromptTimeline}
        onInsertComposerPrompt={onInsertComposerPrompt}
        onInterviewSuggestionPick={onInterviewSuggestionPick}
        onSetReplyTo={(messageId, preview) => {
          onSetReplyTo(messageId, preview);
          window.setTimeout(() => composerTextAreaRef.current?.focus(), 0);
        }}
        onOpenDeliverableDocument={(id) => openDeliverableDocument(id)}
        onOpenDeliverableList={(focusId) => openDeliverableList(focusId)}
        onOpenDeliverableDocuments={(ids) => openDeliverableDocuments(ids)}
        onRegenerateDeliverables={(types) => {
          const next = types.filter(isIdeationDeliverableType);
          if (next.length) onRegenerateDeliverables(next);
        }}
        onConfirmDeliverables={(ids) => void onConfirmDeliverables(ids)}
        composer={composer}
      />
    </div>
  );
}
