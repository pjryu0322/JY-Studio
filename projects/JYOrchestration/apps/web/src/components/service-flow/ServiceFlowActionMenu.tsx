"use client";

import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { WORKSPACE_HUB_CHAT_MENU_Z, workspaceComposerWideToolsPopoverStyle } from "@/components/workspace/workspaceComposerHubMenuLayout";
import plusMenuStyles from "@/components/workspace/workspacePlusMenu.module.css";

export function ServiceFlowActionMenu(p: {
  /** `WorkspaceComposerPlusTrigger`의 `aria-controls`와 연결 */
  readonly menuId?: string;
  /** true면 외부(`WorkspaceComposerToolsMenuFrame`)가 role=menu·팝오버 셸을 제공 */
  readonly omitMenuContainer?: boolean;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onOrganize: () => void;
  readonly onViewResult: () => void;
  readonly onViewPrompt: () => void;
  readonly onOpenMapping: () => void;
  readonly projectId: string;
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly hasFlowContent: boolean;
}) {
  if (!p.open) return null;

  const resultDisabled = !p.hasFlowContent;

  const body = (
    <>
      <button type="button" role="menuitem" onClick={() => p.onOrganize()} className={plusMenuStyles.item}>
        흐름 정리요청
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onOpenMapping();
        }}
        className={plusMenuStyles.item}
      >
        구조 편집
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onViewResult();
        }}
        disabled={resultDisabled}
        className={plusMenuStyles.item}
      >
        결과물 보기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onViewPrompt();
        }}
        className={plusMenuStyles.item}
      >
        프롬프트 보기
      </button>
      <a
        href={appFlowStepHref("execution", p.projectId)}
        role="menuitem"
        onClick={() => p.onClose()}
        aria-disabled={!p.ideationReady}
        className={plusMenuStyles.item}
        title={!p.ideationReady ? p.ideationReadyNotice : "프로토타입 생성"}
      >
        프로토타입 생성
      </a>
    </>
  );

  if (p.omitMenuContainer) return body;

  return (
    <div id={p.menuId} role="menu" aria-label="입력 도구" style={workspaceComposerWideToolsPopoverStyle(WORKSPACE_HUB_CHAT_MENU_Z)}>
      {body}
    </div>
  );
}

