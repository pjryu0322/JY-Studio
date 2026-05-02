"use client";

import type { CSSProperties } from "react";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { uiTokens as t } from "@/components/ui/tokens";

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
    borderRadius: t.radiusMd,
    background: "transparent",
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? t.textMuted : t.textPrimary,
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
        borderRadius: t.radiusLg,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        boxShadow: t.shadowModal,
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
