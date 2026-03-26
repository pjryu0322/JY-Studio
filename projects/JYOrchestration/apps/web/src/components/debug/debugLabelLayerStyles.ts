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

/** 배지 행: top/left 합성. 행은 pointer-events none, 복사 버튼만 auto. */
export const DEBUG_LABEL_BADGE_ROW_STYLE: CSSProperties = {
  position: "fixed",
  display: "flex",
  alignItems: "center",
  gap: 4,
  zIndex: 2147483646,
  pointerEvents: "none",
  maxWidth: "min(320px, 92vw)",
};

/** 라벨 텍스트 칩 (빨간 배경 유지) */
export const DEBUG_LABEL_BADGE_TEXT_STYLE: CSSProperties = {
  background: "rgba(255,0,0,0.85)",
  color: "#fff",
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  pointerEvents: "none",
  flex: "1 1 auto",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
};

/** 복사 버튼만 클릭 가능 */
export const DEBUG_LABEL_COPY_BUTTON_STYLE: CSSProperties = {
  pointerEvents: "auto",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  padding: 0,
  margin: 0,
  border: "1px solid rgba(255,255,255,0.5)",
  borderRadius: 4,
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
};

/** 단일 블록 배지 (오버레이 외 레거시용) */
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
