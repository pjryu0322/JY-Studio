"use client";

import type { RefObject, ReactNode } from "react";
import type { IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import type { RequirementsComposerTargetPickerItem } from "@/components/requirements/RequirementsComposerGpt";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { requirementsIdeationChatPanelShellStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";

export type RequirementsIdeationChatPanelProps = Readonly<{
  showScreenLabels: boolean;
  conversationStatus: "idle" | "loading" | "loaded" | "error";
  ideationConversationOnly: readonly RequirementsMessage[];
  participantAiMemberId: WorkspaceAiMemberId;
  aiInvokePending: boolean;
  inIdeationStage: boolean;
  participantBadgeCount: number;
  onOpenMembersModal: () => void;
  proposalReadinessPercentVal: number;
  problemInterviewCovered: number;
  /** 진행률 분모(오케스트레이션 정렬 시 전체 슬롯 수) */
  progressSlotTotal: number;
  orchestrationSlotSections?: readonly OrchestrationSlotSummarySection[] | null;
  remainingQuestionsEstimate: number;
  onForceGeneratePlanNow: () => void;
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
  onOrganizeRequirements: () => void | Promise<void>;
  organizeDisabled: boolean;
  draftDocTruthy: boolean;
  onOpenDraftView: () => void;
}>;

export function RequirementsIdeationChatPanel({
  showScreenLabels,
  conversationStatus,
  ideationConversationOnly,
  participantAiMemberId,
  aiInvokePending,
  inIdeationStage,
  participantBadgeCount,
  onOpenMembersModal,
  proposalReadinessPercentVal,
  problemInterviewCovered,
  progressSlotTotal,
  orchestrationSlotSections,
  remainingQuestionsEstimate,
  onForceGeneratePlanNow,
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
  onOrganizeRequirements,
  organizeDisabled,
  draftDocTruthy,
  onOpenDraftView,
}: RequirementsIdeationChatPanelProps) {
  const ideationInterviewUi =
    inIdeationStage && conversationStatus === "loaded"
      ? {
          // Orchestration-first: treat interview UI as active in ideation stage, independent of legacy ProblemInterview state.
          active: true,
          readinessPercent: proposalReadinessPercentVal,
          covered: problemInterviewCovered,
          total: progressSlotTotal,
          remainingQuestionsEstimate,
          onForceGeneratePlanNow,
          orchestrationSlotSections: orchestrationSlotSections ?? null,
        }
      : null;

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
        stage="ideation"
        textAreaRef={composerTextAreaRef}
        value={input}
        onChange={onInputChange}
        busy={busy || aiInvokePending}
        disabled={false}
        placeholder={composerPlaceholder}
        targetPickerItems={targetPickerItems}
        onSendIdeation={onSendIdeation}
        onSendServiceFlow={async () => {}}
        onSendFeaturePlanning={async () => {}}
        ideationToolsMenu={{
          onOrganizeRequirements: () => void onOrganizeRequirements(),
          organizeDisabled,
          draftViewAvailable: draftDocTruthy,
          onOpenDraftView,
        }}
      />
    </>
  );

  return (
    <div className="jyo-requirements-chat-panel-shell" style={requirementsIdeationChatPanelShellStyle}>
      <ScreenLabel label="요구사항-채팅영역-대화이력복원" visible={showScreenLabels} />
      <RequirementsChatPanel
        messages={conversationStatus === "loaded" ? ideationConversationOnly : null}
        screenAiMemberId={participantAiMemberId}
        typingIndicator={aiInvokePending}
        memberControls={inIdeationStage ? null : { count: participantBadgeCount, onOpen: onOpenMembersModal }}
        ideationInterviewUi={ideationInterviewUi}
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
