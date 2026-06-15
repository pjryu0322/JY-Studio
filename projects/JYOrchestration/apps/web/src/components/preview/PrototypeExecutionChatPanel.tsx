"use client";

import type { ReactNode, RefObject } from "react";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import { PrototypeExecutionComposer } from "@/components/preview/PrototypeExecutionComposer";
import { ImplementationComposerAttachmentBar } from "@/components/preview/ImplementationComposerAttachmentBar";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import type { ImplementationComposerAttachment } from "@/lib/preview/implementationComposerAttachmentTypes";
import { requirementsIdeationChatPanelShellStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { WorkspaceChatReplyComposerBar } from "@/components/workspace/workspaceMessageHeaderActions";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

export type PrototypeExecutionChatPanelProps = Readonly<{
  conversationStatus: "idle" | "loading" | "loaded";
  chatMessages: readonly RequirementsMessage[];
  memberControls?: { count: number; onOpen: () => void } | null;
  statusPill?: ReactNode | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  busy: boolean;
  inputDisabled: boolean;
  composerPlaceholder: string;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  targetPickerItems: readonly ComposerAtAtPickerItem[];
  replyTo: { id: string; preview: string } | null;
  onClearReplyTo: () => void;
  onSetReplyTo: (messageId: string, preview: string) => void;
  onInterviewSuggestionPick: (label: string) => void;
  aiInvokePending: boolean;
  headerLeading?: ReactNode;
  headerIconToolbar?: ReactNode;
  composerPendingAttachments?: readonly ImplementationComposerAttachment[];
  onRemoveComposerAttachment?: (attachmentId: string) => void;
  composerDisabledReason?: string;
  composerDisableAttachments?: boolean;
  composerDisablePreviewCapture?: boolean;
}>;

export function PrototypeExecutionChatPanel({
  conversationStatus,
  chatMessages,
  memberControls = null,
  statusPill = null,
  input,
  onInputChange,
  onSend,
  busy,
  inputDisabled,
  composerPlaceholder,
  textAreaRef,
  targetPickerItems,
  replyTo,
  onClearReplyTo,
  onSetReplyTo,
  onInterviewSuggestionPick,
  aiInvokePending,
  headerIconToolbar,
  composerPendingAttachments = [],
  onRemoveComposerAttachment,
  composerDisabledReason,
  composerDisableAttachments = false,
  composerDisablePreviewCapture = false,
}: PrototypeExecutionChatPanelProps) {
  const showTyping =
    aiInvokePending &&
    (conversationStatus !== "loaded" || !chatMessages.length || chatMessages[chatMessages.length - 1]?.role !== "ai");

  const composer = (
    <RequirementsChatComposerFooter>
      {replyTo ? <WorkspaceChatReplyComposerBar preview={replyTo.preview} onClear={onClearReplyTo} /> : null}
      {composerPendingAttachments.length && onRemoveComposerAttachment ? (
        <ImplementationComposerAttachmentBar
          attachments={composerPendingAttachments}
          onRemove={onRemoveComposerAttachment}
        />
      ) : null}
      <PrototypeExecutionComposer
        value={input}
        onChange={onInputChange}
        onSend={() => void onSend()}
        busy={busy || aiInvokePending}
        disabled={inputDisabled}
        disabledReason={composerDisabledReason}
        disableAttachments={composerDisableAttachments}
        disablePreviewCapture={composerDisablePreviewCapture}
        placeholder={composerPlaceholder}
        textAreaRef={textAreaRef}
        targetPickerItems={targetPickerItems}
      />
    </RequirementsChatComposerFooter>
  );

  return (
    <div
      className="jyo-prototype-execution-chat-shell"
      style={requirementsIdeationChatPanelShellStyle}
      data-testid="prototype-generation-chat-panel"
    >
      <RequirementsChatPanel
        messages={conversationStatus === "loaded" ? chatMessages : null}
        screenAiMemberId="prototype_build"
        typingIndicator={showTyping}
        typingIndicatorSpeakerLine={aiInvokePending ? "AI 개발자가 응답을 준비하고 있습니다…" : null}
        memberControls={memberControls}
        headerLeading={statusPill}
        headerIconToolbar={headerIconToolbar}
        onSetReplyTo={(id, preview) => {
          onSetReplyTo(id, preview);
          window.setTimeout(() => textAreaRef.current?.focus(), 0);
        }}
        onInterviewSuggestionPick={onInterviewSuggestionPick}
        interviewSuggestionPickDisabled={busy || aiInvokePending}
        composer={composer}
      />
    </div>
  );
}
