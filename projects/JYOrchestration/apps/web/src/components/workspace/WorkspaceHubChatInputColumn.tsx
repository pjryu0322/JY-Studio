"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { ComposerAtAtTargetPicker } from "@/components/composer/ComposerAtAtTargetPicker";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  WorkspaceComposerInputColumn,
  WorkspaceComposerSendIcon,
  workspaceComposerTextareaClassName,
} from "@/components/workspace/WorkspaceComposer";
import {
  WORKSPACE_HUB_CHAT_MENU_Z,
  WORKSPACE_HUB_CHAT_TEXTAREA_MAX_PX,
  WORKSPACE_HUB_SCREEN_LABEL_INPUT,
  WORKSPACE_HUB_SCREEN_LABEL_SEND,
} from "@/components/workspace/workspaceComposerHubMenuLayout";
import composerStyles from "@/components/workspace/workspaceComposer.module.css";
import { useWorkspaceComposerEnterSend } from "@/components/workspace/useWorkspaceComposer";
import { useComposerAtAtPicker } from "@/hooks/useComposerAtAtPicker";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

/**
 * 허브형 채팅 composer의 입력 열(멘션 피커 + textarea + 전송).
 * 스타일은 `workspaceComposer.module.css` 단일 소스 — 요구사항/서비스흐름/기능정리에서 공통 사용.
 */
export function WorkspaceHubChatInputColumn({
  value,
  onChange,
  onSend,
  disabled = false,
  busy = false,
  placeholder,
  textAreaRef,
  targetPickerItems,
  inputTestId,
  screenLabelInput = WORKSPACE_HUB_SCREEN_LABEL_INPUT,
  screenLabelSend = WORKSPACE_HUB_SCREEN_LABEL_SEND,
  menuZ = WORKSPACE_HUB_CHAT_MENU_Z,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly placeholder?: string;
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
  readonly inputTestId?: string;
  readonly screenLabelInput?: string;
  readonly screenLabelSend?: string;
  readonly menuZ?: number;
}) {
  const showScreenLabels = useShowScreenLabels();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const { targetPickerOpen, normalizedTargetPickerItems, closeTargetPicker, pickTargetItem } = useComposerAtAtPicker({
    value,
    onChange,
    items: targetPickerItems,
    textareaRef: taRef,
  });

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(WORKSPACE_HUB_CHAT_TEXTAREA_MAX_PX, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  const onEnterSend = useWorkspaceComposerEnterSend({ onSend, disabled, busy });
  const sendOff = Boolean(busy) || Boolean(disabled);

  return (
    <WorkspaceComposerInputColumn>
      <ScreenLabel label={screenLabelInput} visible={showScreenLabels} />
      <ComposerAtAtTargetPicker
        open={targetPickerOpen}
        items={normalizedTargetPickerItems}
        onPick={pickTargetItem}
        onClose={closeTargetPicker}
        zIndex={menuZ}
      />
      <div className={composerStyles.inputWrap}>
        <textarea
          ref={(el) => {
            taRef.current = el;
            if (textAreaRef) textAreaRef.current = el;
          }}
          data-testid={inputTestId}
          value={value}
          disabled={disabled}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onInput={autoGrow}
          onKeyDown={onEnterSend}
          placeholder={placeholder ?? "메시지를 입력하세요 (Shift+Enter 줄바꿈)"}
          className={workspaceComposerTextareaClassName()}
        />
        <div className={composerStyles.sendStack}>
          <ScreenLabel label={screenLabelSend} visible={showScreenLabels} />
          <button
            type="button"
            disabled={sendOff}
            title="전송"
            aria-label="전송"
            onClick={onSend}
            className={`${composerStyles.sendBtn} ${composerStyles.sendBtnInside} ${sendOff ? composerStyles.sendBtnDisabled : composerStyles.sendBtnActive}`}
          >
            <WorkspaceComposerSendIcon />
          </button>
        </div>
      </div>
    </WorkspaceComposerInputColumn>
  );
}
