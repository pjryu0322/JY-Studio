"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { useComposerNarrowBreakpoint } from "@/components/ui/breakpoints";
import { WorkspaceComposerPlusTrigger } from "@/components/workspace/WorkspaceComposer";
import {
  WORKSPACE_HUB_CHAT_MENU_Z,
  WORKSPACE_HUB_SCREEN_LABEL_ACTION,
  workspaceComposerNarrowMenuGrabberStyle,
  workspaceComposerNarrowMenuInnerFlexStyle,
  workspaceComposerNarrowMenuScrimStyle,
  workspaceComposerNarrowMenuSheetStyle,
  workspaceComposerWideToolsPopoverStyle,
} from "@/components/workspace/workspaceComposerHubMenuLayout";

export type WorkspaceComposerToolsMenuContext = {
  readonly close: () => void;
  /** `WorkspaceComposerPlusTrigger`의 `aria-controls`와 동일 */
  readonly menuId: string;
};

export type WorkspaceComposerToolsMenuFrameProps = {
  /** + 메뉴 항목(와이드 팝오버·내로우 시트 공통) */
  readonly renderMenu: (ctx: WorkspaceComposerToolsMenuContext) => ReactNode;
  readonly plusTestId?: string;
  readonly menuZ?: number;
  readonly menuAriaLabel?: string;
  /**
   * 제어 모드(서비스 흐름 등). 둘 다 주면 외부 상태를 따른다.
   * 생략 시 내부 `useState`로 + 메뉴를 연다.
   */
  readonly menuOpen?: boolean;
  readonly onMenuOpenChange?: (open: boolean) => void;
  /** + 클릭 전용(예: 토글). 없으면 `onMenuOpenChange?.(!open)` 또는 내부 토글 */
  readonly onPlusClick?: () => void;
};

export function WorkspaceComposerToolsMenuFrame({
  renderMenu,
  plusTestId = "workspace-composer-tools-trigger",
  menuZ = WORKSPACE_HUB_CHAT_MENU_Z,
  menuAriaLabel = "입력 도구",
  menuOpen: controlledOpen,
  onMenuOpenChange,
  onPlusClick,
}: WorkspaceComposerToolsMenuFrameProps) {
  const showScreenLabels = useShowScreenLabels();
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const menuId = useId();

  const controlled = typeof controlledOpen === "boolean" && typeof onMenuOpenChange === "function";
  const menuOpen = controlled ? Boolean(controlledOpen) : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) onMenuOpenChange!(next);
      else setInternalOpen(next);
    },
    [controlled, onMenuOpenChange]
  );

  const closeMenu = useCallback(() => setOpen(false), [setOpen]);

  const onPlus = useCallback(() => {
    if (onPlusClick) onPlusClick();
    else setOpen(!menuOpen);
  }, [menuOpen, onPlusClick, setOpen]);

  const narrow = useComposerNarrowBreakpoint();
  useEffect(() => {
    setOpen(false);
  }, [narrow, setOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen || narrow) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (plusRef.current?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, narrow, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const t = window.setTimeout(() => {
      const root = narrow ? sheetRef.current : popoverRef.current;
      const first = root?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      const link = root?.querySelector<HTMLAnchorElement>('a[role="menuitem"]:not([aria-disabled="true"])');
      (first ?? link)?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [menuOpen, narrow]);

  return (
    <>
      <div className="relative" style={{ position: "relative" }}>
        <ScreenLabel label={WORKSPACE_HUB_SCREEN_LABEL_ACTION} visible={showScreenLabels} />
        <WorkspaceComposerPlusTrigger
          plusRef={plusRef}
          menuOpen={menuOpen}
          menuId={menuId}
          onClick={onPlus}
          testId={plusTestId}
        />
        {menuOpen && !narrow ? (
          <div ref={popoverRef} id={menuId} role="menu" aria-label={menuAriaLabel} style={workspaceComposerWideToolsPopoverStyle(menuZ)}>
            {renderMenu({ close: closeMenu, menuId })}
          </div>
        ) : null}
      </div>

      {menuOpen && narrow ? (
        <>
          <button type="button" aria-label="메뉴 닫기" style={workspaceComposerNarrowMenuScrimStyle(menuZ)} onClick={closeMenu} />
          <div
            ref={sheetRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label={menuAriaLabel}
            style={workspaceComposerNarrowMenuSheetStyle(menuZ)}
          >
            <div style={workspaceComposerNarrowMenuGrabberStyle} aria-hidden />
            <div role="menu" style={workspaceComposerNarrowMenuInnerFlexStyle}>
              {renderMenu({ close: closeMenu, menuId })}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
