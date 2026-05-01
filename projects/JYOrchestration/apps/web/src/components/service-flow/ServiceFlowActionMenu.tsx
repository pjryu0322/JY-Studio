"use client";

import type { CSSProperties } from "react";
import { appFlowStepHref } from "@/lib/workflow/flow-state";

const btn: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  cursor: "pointer",
};

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

  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        left: 0,
        bottom: 52,
        width: 240,
        maxWidth: "min(240px, 92vw)",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.22)",
        padding: 8,
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={() => {
          p.onOrganize();
        }}
        style={{ ...btn, width: "100%", textAlign: "left" }}
      >
        흐름 정리요청
      </button>
      <div style={{ height: 6 }} />
      <button
        type="button"
        onClick={() => {
          p.onClose();
          p.onOpenMapping();
        }}
        style={{ ...btn, width: "100%", textAlign: "left" }}
      >
        구조 편집
      </button>
      <div style={{ height: 6 }} />
      <button
        type="button"
        onClick={() => {
          p.onClose();
          p.onViewResult();
        }}
        disabled={!p.hasFlowContent}
        style={{ ...btn, width: "100%", textAlign: "left", opacity: p.hasFlowContent ? 1 : 0.55 }}
      >
        결과물 보기
      </button>
      <div style={{ height: 6 }} />
      <button
        type="button"
        onClick={() => {
          p.onClose();
          p.onViewPrompt();
        }}
        style={{ ...btn, width: "100%", textAlign: "left" }}
      >
        프롬프트 보기
      </button>
      <div style={{ height: 6 }} />
      <a
        href={appFlowStepHref("execution", p.projectId)}
        onClick={() => p.onClose()}
        aria-disabled={!p.ideationReady}
        style={{
          ...btn,
          width: "100%",
          textAlign: "left",
          textDecoration: "none",
          display: "block",
          boxSizing: "border-box",
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
