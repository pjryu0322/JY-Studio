import type { CSSProperties } from "react";
import { composerPopoverAboveAnchorStyle } from "@/components/ui/composerPopoverAboveAnchorStyle";
import { uiTokens as t } from "@/components/ui/tokens";

/** `ComposerAtAtTargetPicker`·도구 팝업이 타임라인 위로 올라오도록 */
export const WORKSPACE_HUB_CHAT_MENU_Z = 200;

/**
 * 모바일(좁은 화면) `+` 도구 메뉴는 중앙 모달로 `document.body`에 포털한다.
 * 상단 크롬·슬롯 패널(z≈1090)보다 위에 두고, `overflow:hidden` 조상에 잘리지 않게 한다.
 */
export const WORKSPACE_COMPOSER_NARROW_PORTAL_Z = 1200;

/** 허브 내 textarea 자동 높이 상한(px) — 요구사항/서비스흐름/기능정리 공통 */
export const WORKSPACE_HUB_CHAT_TEXTAREA_MAX_PX = 220;


/** 데스크톱: + 버튼 위 팝오버 — 구현은 `composerPopoverAboveAnchorStyle`와 동일 */
export function workspaceComposerWideToolsPopoverStyle(zIndex: number): CSSProperties {
  return composerPopoverAboveAnchorStyle(zIndex);
}

/** 좁은 화면 `+` 메뉴: 화면 중앙 카드형 모달 패널 */
export function workspaceComposerNarrowMenuModalStyle(zIndex: number): CSSProperties {
  return {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: zIndex + 1,
    width: "min(360px, calc(100vw - 32px))",
    maxWidth: "calc(100vw - 32px)",
    borderRadius: t.radiusLg,
    border: `1px solid ${t.border}`,
    background: t.bgCard,
    padding: `14px 12px max(14px, env(safe-area-inset-bottom, 0px))`,
    boxShadow: "0 24px 64px -16px rgba(15, 23, 42, 0.35)",
    maxHeight: "min(calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))), 420px)",
    overflowY: "auto",
    margin: 0,
  };
}

export const workspaceComposerNarrowMenuInnerFlexStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
