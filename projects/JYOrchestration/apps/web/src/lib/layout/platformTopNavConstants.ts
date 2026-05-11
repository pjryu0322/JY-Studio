import type { CSSProperties } from "react";

export const PLATFORM_RAIL_COLLAPSED_KEY = "jyo:platformRailCollapsed";

/** 텍스트 전용 레일 셀 기준 폭 (브랜딩 영역 없음) */
export const PLATFORM_RAIL_WIDTH_PX = 78;

/** 접힘 시 화면 좌측 경계에 남기는 펼치기 탭 폭(화살표 전용) */
export const PLATFORM_RAIL_EXPAND_TAB_W = 22;

export const platformRailIconLinkStyle: CSSProperties = {
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: 10,
  border: "none",
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

/** 레일 본문 텍스트(한 줄·가능한 한 크게) */
export const platformRailNavPrimaryText: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
  lineHeight: 1.15,
  textAlign: "center",
  maxWidth: PLATFORM_RAIL_WIDTH_PX,
  letterSpacing: "-0.02em",
  wordBreak: "keep-all",
};

export const platformRailNavPrimaryTextActive: CSSProperties = {
  ...platformRailNavPrimaryText,
  color: "#0f766e",
};

export const platformRailNavPrimaryTextWorkflowActive: CSSProperties = {
  ...platformRailNavPrimaryText,
  color: "#2563eb",
};

/** 메신저 레일 활성 칩(배경·테두리) */
export const platformRailMessengerActiveShell: CSSProperties = {
  border: "1px solid #5eead4",
  background: "#ccfbf1",
  boxShadow: "none",
};

export const platformRailMessengerActiveText: CSSProperties = {
  ...platformRailNavPrimaryText,
  color: "#134e4a",
};

/** 좌측 레일: 세로 스택(텍스트 전용 셀) */
export const platformRailNavColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

/** 텍스트만 있는 레일 내비 셀 (비활성: 투명 배경 + 공통 테두리, 선택 시 `platformRailMessengerActiveShell` 등으로 덮어씀) */
export const platformRailNavTextCell: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "8px 4px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "transparent",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  cursor: "pointer",
  textDecoration: "none",
  outlineOffset: 2,
  flexShrink: 0,
  position: "relative",
  color: "inherit",
};

export const platformRailNavLabel: CSSProperties = {
  ...platformRailNavPrimaryText,
  fontSize: 12,
  color: "#64748b",
};

export const platformRailNavLabelActive: CSSProperties = {
  ...platformRailNavLabel,
  color: "#0f766e",
};

/** 접힘: 화면 왼쪽 세로 경계에 붙는 펼치기 탭 */
export function platformRailExpandTabStyle(railExpandTabW: number): CSSProperties {
  return {
    position: "fixed",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 45,
    width: railExpandTabW,
    height: 56,
    padding: 0,
    borderRadius: "0 8px 8px 0",
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

/** 펼침: 레일과 본문 사이 세로 경계에 붙는 접기 탭(레일 `position: relative` 기준) */
export function platformRailCollapseEdgeTabStyle(): CSSProperties {
  return {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translate(50%, -50%)",
    zIndex: 41,
    width: 16,
    height: 56,
    padding: 0,
    margin: 0,
    borderRadius: "0 8px 8px 0",
    border: "1px solid #e2e8f0",
    borderLeft: "none",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "2px 0 12px -4px rgba(15, 23, 42, 0.12)",
    cursor: "pointer",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}
