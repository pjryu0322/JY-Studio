"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { uiFixedViewportScrimButtonStyle } from "@/components/ui/fixedViewportScrimStyle";
import { useComposerNarrowBreakpoint } from "@/components/ui/breakpoints";
import { WorkspaceComposerPlusTrigger } from "@/components/workspace/WorkspaceComposer";
import {
  WORKSPACE_HUB_CHAT_MENU_Z,
  workspaceComposerNarrowMenuInnerFlexStyle,
  workspaceComposerNarrowMenuModalStyle,
  workspaceComposerWideToolsPopoverStyle,
  WORKSPACE_COMPOSER_NARROW_PORTAL_Z,
} from "@/components/workspace/workspaceComposerHubMenuLayout";
import { focusFirstRoleMenuitem } from "@/lib/ui/focusFirstRoleMenuitem";

export type WorkspaceComposerToolsMenuContext = {
  readonly close: () => void;
  /** `WorkspaceComposerPlusTrigger`의 `aria-controls`와 동일 */
  readonly menuId: string;
};

export type WorkspaceComposerToolsMenuFrameProps = {
  /** + 메뉴 항목(와이드 팝오버·좁은 화면 중앙 모달 공통) */
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

function useComposerToolsMenuOpenState(
  controlledOpen: boolean | undefined,
  onMenuOpenChange: ((open: boolean) => void) | undefined
) {
  const [internalOpen, setInternalOpen] = useState(false);
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

  return { menuOpen, setOpen, closeMenu };
}

function useComposerToolsMenuEffects(input: {
  readonly menuOpen: boolean;
  readonly narrow: boolean;
  readonly closeMenu: () => void;
  readonly plusRef: RefObject<HTMLButtonElement | null>;
  readonly popoverRef: RefObject<HTMLDivElement | null>;
  readonly narrowModalRef: RefObject<HTMLDivElement | null>;
  readonly setOpen: (next: boolean) => void;
}) {
  const { menuOpen, narrow, closeMenu, plusRef, popoverRef, narrowModalRef, setOpen } = input;

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
  }, [menuOpen, narrow, closeMenu, plusRef, popoverRef]);

  useEffect(() => {
    if (!menuOpen) return;
    const id = window.setTimeout(() => {
      focusFirstRoleMenuitem(narrow ? narrowModalRef.current : popoverRef.current);
    }, 0);
    return () => window.clearTimeout(id);
  }, [menuOpen, narrow, narrowModalRef, popoverRef]);
}

type NarrowToolsMenuPortalProps = Readonly<{
  portalZ: number;
  menuId: string;
  menuAriaLabel: string;
  modalRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}>;

function NarrowToolsMenuPortal({ portalZ, menuId, menuAriaLabel, modalRef, onClose, children }: NarrowToolsMenuPortalProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <button type="button" aria-label="메뉴 닫기" style={uiFixedViewportScrimButtonStyle(portalZ)} onClick={onClose} />
      <div
        ref={modalRef}
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-label={menuAriaLabel}
        style={workspaceComposerNarrowMenuModalStyle(portalZ)}
      >
        <div role="menu" style={workspaceComposerNarrowMenuInnerFlexStyle}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

export function WorkspaceComposerToolsMenuFrame({
  renderMenu,
  plusTestId = "workspace-composer-tools-trigger",
  menuZ = WORKSPACE_HUB_CHAT_MENU_Z,
  menuAriaLabel = "입력 도구",
  menuOpen: controlledOpen,
  onMenuOpenChange,
  onPlusClick,
}: WorkspaceComposerToolsMenuFrameProps) {
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const narrowModalRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const { menuOpen, setOpen, closeMenu } = useComposerToolsMenuOpenState(controlledOpen, onMenuOpenChange);

  const menuCtx = useMemo((): WorkspaceComposerToolsMenuContext => ({ close: closeMenu, menuId }), [closeMenu, menuId]);
  const menuContent = menuOpen ? renderMenu(menuCtx) : null;

  const onPlus = useCallback(() => {
    if (onPlusClick) onPlusClick();
    else setOpen(!menuOpen);
  }, [menuOpen, onPlusClick, setOpen]);

  const narrow = useComposerNarrowBreakpoint();
  const portalZ = Math.max(menuZ, WORKSPACE_COMPOSER_NARROW_PORTAL_Z);

  useComposerToolsMenuEffects({
    menuOpen,
    narrow,
    closeMenu,
    plusRef,
    popoverRef,
    narrowModalRef,
    setOpen,
  });

  const narrowMenuPortal =
    menuOpen && narrow ? (
      <NarrowToolsMenuPortal
        portalZ={portalZ}
        menuId={menuId}
        menuAriaLabel={menuAriaLabel}
        modalRef={narrowModalRef}
        onClose={closeMenu}
      >
        {menuContent}
      </NarrowToolsMenuPortal>
    ) : null;

  return (
    <>
      <div className="relative" style={{ position: "relative" }}>
        <WorkspaceComposerPlusTrigger
          plusRef={plusRef}
          menuOpen={menuOpen}
          menuId={menuId}
          onClick={onPlus}
          testId={plusTestId}
        />
        {menuOpen && !narrow ? (
          <div ref={popoverRef} id={menuId} role="menu" aria-label={menuAriaLabel} style={workspaceComposerWideToolsPopoverStyle(menuZ)}>
            {menuContent}
          </div>
        ) : null}
      </div>

      {narrowMenuPortal}
    </>
  );
}
