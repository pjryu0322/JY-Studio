"use client";

import type { MutableRefObject } from "react";
import {
  WorkspaceComposerColumn,
  WorkspaceComposerHubRow,
  WorkspaceComposerLeadingSlot,
} from "@/components/workspace/WorkspaceComposer";
import { WorkspaceComposerToolsMenuFrame } from "@/components/workspace/WorkspaceComposerToolsMenuFrame";
import { WorkspaceHubChatInputColumn } from "@/components/workspace/WorkspaceHubChatInputColumn";
import { WORKSPACE_HUB_CHAT_MENU_Z } from "@/components/workspace/workspaceComposerHubMenuLayout";
import { WorkspacePlusMenuItems } from "@/components/workspace/WorkspacePlusMenu";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";

export type RequirementsComposerToolsMenu = {
  readonly onOrganizeRequirements: () => void;
  readonly organizeDisabled: boolean;
  readonly draftViewAvailable: boolean;
  readonly onOpenDraftView: () => void;
  /** + 메뉴 첫 항목 라벨(기본: 정리 요청) */
  readonly organizeMenuTitle?: string;
  /** + 메뉴 둘째 항목 라벨(기본: 정리본 보기). `draftViewAvailable`이 true일 때만 표시 */
  readonly draftMenuTitle?: string;
};

export type { ComposerAtAtPickerItem as RequirementsComposerTargetPickerItem } from "@/lib/composer/composerAtAtPicker";

export function RequirementsComposerGpt({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  placeholder,
  toolsMenu,
  textAreaRef,
  targetPickerItems,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  /** + 메뉴(정리 요청 등). 없으면 + 버튼 미표시 */
  readonly toolsMenu?: RequirementsComposerToolsMenu;
  /** 부모에서 포커스·커서 제어용(선택) */
  readonly textAreaRef?: MutableRefObject<HTMLTextAreaElement | null>;
  /** `@@` 입력 시 노출할 멘션 후보(멤버별 1행) */
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
}) {
  const menuZ = WORKSPACE_HUB_CHAT_MENU_Z;

  return (
    <WorkspaceComposerColumn>
      <WorkspaceComposerHubRow>
        {toolsMenu ? (
          <WorkspaceComposerLeadingSlot>
            <WorkspaceComposerToolsMenuFrame
              renderMenu={({ close }) => <WorkspacePlusMenuItems tools={toolsMenu} onPick={close} />}
              menuZ={menuZ}
            />
          </WorkspaceComposerLeadingSlot>
        ) : null}
        <WorkspaceHubChatInputColumn
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          busy={busy}
          placeholder={placeholder}
          textAreaRef={textAreaRef}
          targetPickerItems={targetPickerItems}
          inputTestId="requirements-chat-input"
          menuZ={menuZ}
        />
      </WorkspaceComposerHubRow>
    </WorkspaceComposerColumn>
  );
}
