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
import type { SingleChatOrchestrationStatusCounts } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { requirementsIdeationChatPanelShellStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";

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
  /** SingleChat 입력·하네스 라우팅용 내부 단계 */
  serviceDesignStage: RequirementsWorkspaceStage;
  /** 채팅 헤더 참가자 배지(통합 화면에서는 항상 전달 권장) */
  memberControls?: { count: number; onOpen: () => void } | null;
  proposalReadinessPercentVal: number;
  problemInterviewCovered: number;
  /** 진행률 분모(오케스트레이션 정렬 시 전체 슬롯 수) */
  progressSlotTotal: number;
  orchestrationSlotSections?: readonly OrchestrationSlotSummarySection[] | null;
  orchestrationStatusCounts?: SingleChatOrchestrationStatusCounts | null;
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
  typingIndicatorSpeakerLine?: string | null;
  typingIndicatorResolvedSpeakerSource?: string | null;
  /** 채팅 내 내 메시지 표시명(세션 닉네임) */
  sessionUserDisplayName?: string;
  onOrganizeRequirements: () => void | Promise<void>;
  organizeDisabled: boolean;
  draftDocTruthy: boolean;
  onOpenDraftView: () => void;
  /** H7.5: explainability 보조 매핑용 */
  promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  onOpenPromptTimeline?: () => void;
}>;

export function RequirementsIdeationChatPanel({
  showScreenLabels,
  conversationStatus,
  chatMessages,
  participantAiMemberId,
  aiInvokePending,
  serviceFlowAnalyzePending = false,
  serviceFlowPendingStatusLabel = null,
  serviceDesignStage,
  memberControls,
  proposalReadinessPercentVal,
  problemInterviewCovered,
  progressSlotTotal,
  orchestrationSlotSections,
  orchestrationStatusCounts,
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
  typingIndicatorSpeakerLine,
  typingIndicatorResolvedSpeakerSource,
  sessionUserDisplayName,
  onOrganizeRequirements,
  organizeDisabled,
  draftDocTruthy,
  onOpenDraftView,
  promptTimeline,
  onOpenPromptTimeline,
}: RequirementsIdeationChatPanelProps) {
  const ideationInterviewUi =
    conversationStatus === "loaded"
      ? {
          active: true,
          readinessPercent: proposalReadinessPercentVal,
          covered: problemInterviewCovered,
          total: progressSlotTotal,
          statusCounts: orchestrationStatusCounts ?? null,
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
        stage={serviceDesignStage}
        textAreaRef={composerTextAreaRef}
        value={input}
        onChange={onInputChange}
        busy={busy || aiInvokePending || serviceFlowAnalyzePending}
        disabled={false}
        placeholder={composerPlaceholder}
        targetPickerItems={targetPickerItems}
        onSendIdeation={onSendIdeation}
        onSendServiceFlow={onSendIdeation}
        onSendFeaturePlanning={onSendIdeation}
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
        messages={conversationStatus === "loaded" ? chatMessages : null}
        screenAiMemberId={participantAiMemberId}
        typingIndicator={aiInvokePending || serviceFlowAnalyzePending}
        typingIndicatorSpeakerLine={
          serviceFlowAnalyzePending
            ? String(serviceFlowPendingStatusLabel ?? "").trim() ||
              "AI 기획자가 응답을 준비하고 있습니다…"
            : typingIndicatorSpeakerLine
        }
        typingIndicatorResolvedSpeakerSource={
          serviceFlowAnalyzePending ? "service-flow-analyze" : typingIndicatorResolvedSpeakerSource
        }
        sessionUserDisplayName={sessionUserDisplayName}
        memberControls={memberControls}
        promptTimeline={promptTimeline}
        onOpenPromptTimeline={onOpenPromptTimeline}
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
