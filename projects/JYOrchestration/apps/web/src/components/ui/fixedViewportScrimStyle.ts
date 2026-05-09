import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

/**
 * 화면 전체를 덮는 고정 스크림을 `<button>`으로 쓸 때의 공통 스타일
 * (모달·바텀시트·모바일 드로어 배경 클릭으로 닫기 등).
 */
export function uiFixedViewportScrimButtonStyle(zIndex: number): CSSProperties {
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
