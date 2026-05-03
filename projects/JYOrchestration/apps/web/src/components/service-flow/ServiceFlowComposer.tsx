"use client";

import type { MutableRefObject, ReactNode } from "react";
import {
  WorkspaceComposerColumn,
  WorkspaceComposerHubRow,
  WorkspaceComposerLeadingSlot,
} from "@/components/workspace/WorkspaceComposer";
import { WorkspaceComposerToolsMenuFrame } from "@/components/workspace/WorkspaceComposerToolsMenuFrame";
import { WorkspaceHubChatInputColumn } from "@/components/workspace/WorkspaceHubChatInputColumn";
import { WORKSPACE_HUB_CHAT_MENU_Z } from "@/components/workspace/workspaceComposerHubMenuLayout";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

export type ServiceFlowActionMenuRenderContext = {
  readonly menuId: string;
  readonly close: () => void;
};

/**
 * 액터·서비스 흐름 단계 대화 입력 — 입력 열은 `WorkspaceHubChatInputColumn`(요구사항·기능정리와 동일 스타일 경로).
 */
export function ServiceFlowComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  onOpenActions,
  onToolsOpenChange,
  textAreaRef,
  renderActionMenu,
  actionsOpen,
  targetPickerItems,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSubmit: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onOpenActions: () => void;
  readonly onToolsOpenChange: (open: boolean) => void;
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  readonly renderActionMenu: (ctx: ServiceFlowActionMenuRenderContext) => ReactNode;
  readonly actionsOpen: boolean;
  /** `@@` 멘션 후보(요구사항 컴포저와 동일 규칙) */
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
}) {
  return (
    <WorkspaceComposerColumn>
      <WorkspaceComposerHubRow>
        <WorkspaceComposerLeadingSlot>
          <WorkspaceComposerToolsMenuFrame
            menuOpen={actionsOpen}
            onMenuOpenChange={onToolsOpenChange}
            onPlusClick={onOpenActions}
            plusTestId="service-flow-composer-tools-trigger"
            menuZ={WORKSPACE_HUB_CHAT_MENU_Z}
            renderMenu={({ close, menuId }) => renderActionMenu({ menuId, close })}
          />
        </WorkspaceComposerLeadingSlot>
        <WorkspaceHubChatInputColumn
          value={value}
          onChange={onChange}
          onSend={onSubmit}
          disabled={disabled}
          busy={false}
          placeholder={placeholder}
          textAreaRef={textAreaRef}
          targetPickerItems={targetPickerItems}
          inputTestId="service-flow-chat-input"
          menuZ={WORKSPACE_HUB_CHAT_MENU_Z}
        />
      </WorkspaceComposerHubRow>
    </WorkspaceComposerColumn>
  );
}
