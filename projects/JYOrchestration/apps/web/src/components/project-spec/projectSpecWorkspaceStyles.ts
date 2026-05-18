import type { CSSProperties } from "react";

/** 기본 흰 카드 패널 — 스펙 워크스페이스 본문 섹션 공통 */
export const specWsPanelWhite: CSSProperties = {
  marginBottom: 20,
  padding: 16,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

export const specWsPanelWhiteTightBottom: CSSProperties = {
  ...specWsPanelWhite,
  marginBottom: 16,
};

/** 확정 스펙 / 버전 이력 영역 */
export const specWsPanelConfirmed: CSSProperties = {
  padding: 16,
  borderRadius: 10,
  border: "1px solid #86efac",
  background: "#f0fdf4",
};
