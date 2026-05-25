"use client";

import type { ReactNode, RefObject } from "react";
import { RequirementsChatPanel } from "@/components/requirements/RequirementsChatPanel";
import { PrototypeExecutionComposer } from "@/components/preview/PrototypeExecutionComposer";
import {
  PROTOTYPE_INLINE_TEMPLATE_AI_VALUE,
  InlineTemplatePickerRow,
  type PrototypeInlineTemplatePickerProps,
} from "@/components/preview/prototypeChatTimeline";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import { requirementsIdeationChatPanelShellStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import { WorkspaceChatReplyComposerBar } from "@/components/workspace/workspaceMessageHeaderActions";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
export type PrototypeExecutionChatPanelProps = Readonly<{
  conversationStatus: "idle" | "loading" | "loaded";
  chatMessages: readonly RequirementsMessage[];
  memberControls: { count: number; onOpen: () => void };
  statusPill: ReactNode;
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
  templatePicker?: PrototypeInlineTemplatePickerProps | null;
  headerLeading?: ReactNode;
}>;

/** 구현 단계 — 기획 `RequirementsIdeationChatPanel`과 동일 SingleChat 셸 */
export function PrototypeExecutionChatPanel({
  conversationStatus,
  chatMessages,
  memberControls,
  statusPill,
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
  templatePicker,
}: PrototypeExecutionChatPanelProps) {
  const showTyping =
    aiInvokePending &&
    (conversationStatus !== "loaded" || !chatMessages.length || chatMessages[chatMessages.length - 1]?.role !== "ai");

  const composer = (
    <>
      {replyTo ? <WorkspaceChatReplyComposerBar preview={replyTo.preview} onClear={onClearReplyTo} /> : null}
      {templatePicker ? (
        <div style={{ marginBottom: 10 }}>
          <InlineTemplatePickerRow {...templatePicker} />
        </div>
      ) : null}
      <PrototypeExecutionComposer
        value={input}
        onChange={onInputChange}
        onSend={() => void onSend()}
        busy={busy || aiInvokePending}
        disabled={inputDisabled}
        placeholder={composerPlaceholder}
        textAreaRef={textAreaRef}
        targetPickerItems={targetPickerItems}
      />
    </>
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
        onSetReplyTo={(id, preview) => {
          onSetReplyTo(id, preview);
          window.setTimeout(() => textAreaRef.current?.focus(), 0);
        }}
        onInterviewSuggestionPick={onInterviewSuggestionPick}
        composer={
          <div data-prototype-composer-root>
            <RequirementsChatComposerFooter>{composer}</RequirementsChatComposerFooter>
          </div>
        }
      />
    </div>
  );
}

export { PROTOTYPE_INLINE_TEMPLATE_AI_VALUE };
