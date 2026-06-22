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
  disabledReason,
  disableAttachments = false,
  disablePreviewCapture = false,
  placeholder,
  textAreaRef,
  targetPickerItems,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly disableAttachments?: boolean;
  readonly disablePreviewCapture?: boolean;
  readonly placeholder?: string;
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
}) {
  const inputDisabled = disabled || disableAttachments || disablePreviewCapture;
  return (
    <WorkspaceComposerColumn>
      <WorkspaceComposerHubRow>
        <WorkspaceHubChatInputColumn
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={inputDisabled}
          busy={busy}
          placeholder={placeholder ?? (disabledReason && inputDisabled ? disabledReason : undefined)}
          textAreaRef={textAreaRef}
          targetPickerItems={targetPickerItems}
          inputTestId="prototype-execution-chat-input"
        />
      </WorkspaceComposerHubRow>
    </WorkspaceComposerColumn>
  );
}
