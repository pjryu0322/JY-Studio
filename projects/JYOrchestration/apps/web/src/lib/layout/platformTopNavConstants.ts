import type { CSSProperties } from "react";

export const PLATFORM_RAIL_COLLAPSED_KEY = "jyo:platformRailCollapsed";

/** 아이콘·패딩 기준 최소 폭 (브랜딩 영역 없음) */
export const PLATFORM_RAIL_WIDTH_PX = 52;

/** 접힘 시 화면 좌측에 남기는 펼치기 탭 폭 */
export const PLATFORM_RAIL_EXPAND_TAB_W = 30;

export const platformRailIconLinkStyle: CSSProperties = {
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  cursor: "pointer",
  outlineOffset: 2,
  textDecoration: "none",
};

export function platformRailExpandTabStyle(railExpandTabW: number): CSSProperties {
  return {
    position: "fixed",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 45,
    width: railExpandTabW,
    height: 52,
    padding: 0,
    borderRadius: "0 10px 10px 0",
    border: "1px solid #e2e8f0",
    borderLeft: "none",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "2px 0 12px -4px rgba(15, 23, 42, 0.12)",
    cursor: "pointer",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}
