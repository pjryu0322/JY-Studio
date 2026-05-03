import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

/** `ComposerAtAtTargetPicker`·도구 팝업이 타임라인 위로 올라오도록 */
export const WORKSPACE_HUB_CHAT_MENU_Z = 200;

/** 허브 내 textarea 자동 높이 상한(px) — 요구사항/서비스흐름/기능정리 공통 */
export const WORKSPACE_HUB_CHAT_TEXTAREA_MAX_PX = 220;

export const WORKSPACE_HUB_SCREEN_LABEL_ACTION = "요구사항-입력창-액션행";
export const WORKSPACE_HUB_SCREEN_LABEL_INPUT = "요구사항-채팅영역-입력창";
export const WORKSPACE_HUB_SCREEN_LABEL_SEND = "요구사항-채팅영역-전송버튼";

/** 데스크톱: + 버튼 위 팝오버 컨테이너 (`RequirementsComposerGpt` 등과 동일) */
export function workspaceComposerWideToolsPopoverStyle(zIndex: number): CSSProperties {
  return {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    minWidth: 216,
    padding: 6,
    borderRadius: t.radiusLg,
    border: `1px solid ${t.border}`,
    background: t.bgCard,
    boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.2)",
    zIndex,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
}

export function workspaceComposerNarrowMenuScrimStyle(zIndex: number): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex,
    border: 0,
    padding: 0,
    margin: 0,
    background: t.overlayScrim,
    cursor: "pointer",
  };
}

export function workspaceComposerNarrowMenuSheetStyle(zIndex: number): CSSProperties {
  return {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: zIndex + 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTop: `1px solid ${t.border}`,
    background: t.bgCard,
    padding: "10px 12px 20px",
    boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
    maxHeight: "min(70vh, 420px)",
    overflowY: "auto",
  };
}

export const workspaceComposerNarrowMenuGrabberStyle: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 999,
  background: t.border,
  margin: "4px auto 12px",
};

export const workspaceComposerNarrowMenuInnerFlexStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
