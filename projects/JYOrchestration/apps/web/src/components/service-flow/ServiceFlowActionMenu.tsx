"use client";

import type { CSSProperties } from "react";
import { appFlowStepHref } from "@/lib/workflow/flow-state";

const MENU_Z = 72;

function menuItemStyle(disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    textAlign: "left",
    padding: "11px 14px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? "#94a3b8" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    boxSizing: "border-box",
  };
}

export function ServiceFlowActionMenu(p: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onOrganize: () => void;
  readonly onViewResult: () => void;
  readonly onViewPrompt: () => void;
  readonly onOpenMapping: () => void;
  readonly projectId: string;
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly hasFlowContent: boolean;
}) {
  if (!p.open) return null;

  const resultDisabled = !p.hasFlowContent;

  return (
    <div
      role="menu"
      aria-label="입력 도구"
      style={{
        position: "absolute",
        left: 0,
        bottom: "calc(100% + 8px)",
        minWidth: 216,
        padding: 6,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.2)",
        zIndex: MENU_Z,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onOrganize();
        }}
        style={menuItemStyle(false)}
      >
        흐름 정리요청
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onOpenMapping();
        }}
        style={menuItemStyle(false)}
      >
        구조 편집
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onViewResult();
        }}
        disabled={resultDisabled}
        style={menuItemStyle(resultDisabled)}
      >
        결과물 보기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          p.onClose();
          p.onViewPrompt();
        }}
        style={menuItemStyle(false)}
      >
        프롬프트 보기
      </button>
      <a
        href={appFlowStepHref("execution", p.projectId)}
        role="menuitem"
        onClick={() => p.onClose()}
        aria-disabled={!p.ideationReady}
        style={{
          ...menuItemStyle(!p.ideationReady),
          textDecoration: "none",
          display: "block",
          opacity: p.ideationReady ? 1 : 0.55,
          pointerEvents: p.ideationReady ? "auto" : "none",
        }}
        title={!p.ideationReady ? p.ideationReadyNotice : "프로토타입 생성"}
      >
        프로토타입 생성
      </a>
    </div>
  );
}
