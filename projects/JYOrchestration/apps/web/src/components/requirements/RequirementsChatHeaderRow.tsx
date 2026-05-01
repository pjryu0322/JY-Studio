"use client";

import { forwardRef, type ReactNode } from "react";

/**
 * 아이디어 구체화·서비스 흐름 등 요구사항 협업 채팅 상단 공통 행:
 * 왼쪽 `leading` + 오른쪽 참여 멤버 버튼(선택).
 */
export const RequirementsChatHeaderRow = forwardRef<
  HTMLDivElement,
  {
    readonly leading: ReactNode;
    readonly memberControls?: { readonly count: number; readonly onOpen: () => void } | null;
  }
>(function RequirementsChatHeaderRow({ leading, memberControls }, ref) {
  const membersUi = memberControls ?? null;

  return (
    <div
      ref={ref}
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{leading}</div>
      {membersUi ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            data-testid="requirements-members-open"
            onClick={() => membersUi.onOpen()}
            aria-label={`참여 멤버 보기 (${Math.max(0, membersUi.count)}명)`}
            title="참여 멤버 보기"
            style={{
              position: "relative",
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M16 11a4 4 0 1 0-8 0" />
              <path d="M4 20c1.2-3.2 4.3-5 8-5s6.8 1.8 8 5" />
              <path d="M16.5 7.5a3 3 0 1 0 0-6" />
            </svg>
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "#0f766e",
                color: "#fff",
                border: "2px solid #fff",
                fontSize: 11,
                fontWeight: 900,
                lineHeight: "14px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              {Math.max(0, membersUi.count)}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
});
