import type { CSSProperties } from "react";

/**
 * DebugLabelLayer 제거 전 사용하던 인라인 스타일 그대로.
 * 전역 UiLabelOverlay가 동일한 시각을 쓰도록 이 모듈만 단일 소스로 둔다.
 */
export const DEBUG_LABEL_OVERLAY_ROOT_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 2147483000,
};

/** 렌더 시 top / left 는 요소별로 합친다. */
export const DEBUG_LABEL_BADGE_BASE_STYLE: CSSProperties = {
  position: "fixed",
  background: "rgba(255,0,0,0.85)",
  color: "#fff",
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  zIndex: 2147483646,
  pointerEvents: "none",
  maxWidth: "min(280px, 90vw)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
};
