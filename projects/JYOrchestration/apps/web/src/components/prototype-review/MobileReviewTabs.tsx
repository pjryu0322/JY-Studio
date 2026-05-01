"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type MobileReviewTabId = "preview" | "chat";

const bar: CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 30,
  display: "flex",
  borderTop: `1px solid ${t.border}`,
  background: t.bgCard,
  paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
  paddingTop: 8,
  paddingLeft: 8,
  paddingRight: 8,
  gap: 8,
  boxSizing: "border-box",
};

function seg(active: boolean): CSSProperties {
  return {
    flex: 1,
    textAlign: "center",
    padding: "10px 8px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
    background: active ? `${t.primary}18` : t.bgPage,
    color: active ? t.primary : t.textSecondary,
    cursor: "pointer",
  };
}

export function MobileReviewTabs(p: {
  readonly value: MobileReviewTabId;
  readonly onChange: (id: MobileReviewTabId) => void;
}) {
  return (
    <nav style={bar} aria-label="검토 화면 탭">
      <button type="button" style={seg(p.value === "preview")} onClick={() => p.onChange("preview")}>
        미리보기
      </button>
      <button type="button" style={seg(p.value === "chat")} onClick={() => p.onChange("chat")}>
        검토대화
      </button>
    </nav>
  );
}
