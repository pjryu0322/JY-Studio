"use client";

import type { ReactNode } from "react";

/** 아이디어 구체화 `RequirementsChatPanel` 하단과 동일한 입력 영역 래퍼(배경·구분선·패딩). */
export function RequirementsChatComposerFooter({ children }: { readonly children: ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "12px 18px 16px",
        borderTop: "1px solid #e2e8f0",
        background: "#f8fafc",
        overflow: "visible",
        position: "relative",
        zIndex: 4,
      }}
    >
      {children}
    </div>
  );
}
