"use client";

import {
  WorkspaceComposerColumn,
  WorkspaceComposerHubRow,
  WorkspaceComposerLeadingSlot,
} from "@/components/workspace/WorkspaceComposer";
import { WorkspaceComposerToolsMenuFrame } from "@/components/workspace/WorkspaceComposerToolsMenuFrame";
import { WorkspaceHubChatInputColumn } from "@/components/workspace/WorkspaceHubChatInputColumn";
import { WORKSPACE_HUB_CHAT_MENU_Z } from "@/components/workspace/workspaceComposerHubMenuLayout";
import { WorkspacePlusMenuDivider } from "@/components/workspace/WorkspacePlusMenu";
import plusMenuStyles from "@/components/workspace/workspacePlusMenu.module.css";

function MenuItemText({ title }: { readonly title: string }) {
  return (
    <span className={plusMenuStyles.stack}>
      <span className={plusMenuStyles.title}>{title}</span>
    </span>
  );
}

/**
 * 기능 정리 워크스페이스 composer — 허브·입력·전송은 `WorkspaceHubChatInputColumn`·`workspaceComposer.module.css` 공통 경로.
 */
export function FeaturePlanningComposer({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  placeholder,
  onOpenResultsView,
  onRequestPlannerOrganize,
  onResetChat,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onOpenResultsView: () => void;
  readonly onRequestPlannerOrganize: () => void;
  /** 초안이 있을 때만 넘기면 `+` 메뉴에 「대화 초기화」가 나타난다. */
  readonly onResetChat?: () => void;
}) {
  const menuZ = WORKSPACE_HUB_CHAT_MENU_Z;

  return (
    <WorkspaceComposerColumn>
      <WorkspaceComposerHubRow>
        <WorkspaceComposerLeadingSlot>
          <WorkspaceComposerToolsMenuFrame
            plusTestId="feature-planning-composer-tools-trigger"
            menuZ={menuZ}
            renderMenu={({ close }) => (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    onRequestPlannerOrganize();
                    close();
                  }}
                  className={plusMenuStyles.item}
                >
                  <MenuItemText title="기능 정리 요청" />
                </button>
                <WorkspacePlusMenuDivider />
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    onOpenResultsView();
                    close();
                  }}
                  className={plusMenuStyles.item}
                >
                  <MenuItemText title="결과물 보기" />
                </button>
                {onResetChat ? (
                  <>
                    <WorkspacePlusMenuDivider />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => {
                        if (busy) return;
                        onResetChat();
                        close();
                      }}
                      className={plusMenuStyles.item}
                    >
                      <MenuItemText title="대화 초기화" />
                    </button>
                  </>
                ) : null}
              </>
            )}
          />
        </WorkspaceComposerLeadingSlot>
        <WorkspaceHubChatInputColumn
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          busy={busy}
          placeholder={placeholder}
          inputTestId="feature-planning-chat-input"
          menuZ={menuZ}
        />
      </WorkspaceComposerHubRow>
    </WorkspaceComposerColumn>
  );
}
