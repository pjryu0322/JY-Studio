"use client";

import type { MutableRefObject } from "react";
import {
  WorkspaceComposerColumn,
  WorkspaceComposerHubRow,
} from "@/components/workspace/WorkspaceComposer";
import { WorkspaceHubChatInputColumn } from "@/components/workspace/WorkspaceHubChatInputColumn";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

export function PrototypeExecutionComposer({
  value,
  onChange,
  onSend,
  busy,
  disabled = false,
  placeholder,
  textAreaRef,
  targetPickerItems,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
}) {
  return (
    <WorkspaceComposerColumn>
      <WorkspaceComposerHubRow>
        <WorkspaceHubChatInputColumn
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          busy={busy}
          placeholder={placeholder}
          textAreaRef={textAreaRef}
          targetPickerItems={targetPickerItems}
          inputTestId="prototype-execution-chat-input"
          screenLabelInput="구현-채팅-입력"
          screenLabelSend="구현-채팅-전송"
        />
      </WorkspaceComposerHubRow>
    </WorkspaceComposerColumn>
  );
}
