"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui";

function SvgGear({ size = 18 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

const menuItemBase: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  color: t.textPrimary,
};

const menuItemDisabled: CSSProperties = {
  ...menuItemBase,
  cursor: "not-allowed",
  opacity: 0.45,
  color: t.textMuted,
};

/**
 * 제목 옆 설정(톱니) — 제목 변경·대화 설정·요약·현재 대화를 프로젝트로 전환(선택)·나가기·삭제.
 */
export function MessengerRoomSettingsGearMenu(p: {
  readonly disabled?: boolean;
  readonly menuBusy?: boolean;
  readonly showRename: boolean;
  readonly showAiSettings?: boolean;
  readonly showAiSummarize?: boolean;
  readonly showProjectApply?: boolean;
  readonly aiSummarizeDisabled?: boolean;
  readonly projectApplyDisabled?: boolean;
  readonly showLeave: boolean;
  readonly showDelete: boolean;
  readonly onRename: () => void;
  readonly onAiSettings?: () => void;
  readonly onAiSummarize?: () => void;
  readonly onProjectApply?: () => void;
  readonly onLeave: () => void | Promise<void>;
  readonly onDelete: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = Boolean(p.disabled || p.menuBusy);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  const closeAnd = (fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  };

  if (
    !p.showRename &&
    !p.showLeave &&
    !p.showDelete &&
    !p.showAiSettings &&
    !p.showAiSummarize &&
    !p.showProjectApply
  ) {
    return null;
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        title="대화방 설정"
        aria-label="대화방 설정"
        aria-expanded={open}
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy) return;
          setOpen((v) => !v);
        }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: open ? "#f1f5f9" : "#fff",
          color: "#475569",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.45 : 1,
          padding: 0,
        }}
      >
        <SvgGear />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 260,
            maxWidth: "min(320px, calc(100vw - 24px))",
            zIndex: 80,
            background: t.bgCard,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            padding: 6,
            boxSizing: "border-box",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {p.showRename ? (
            <button type="button" role="menuitem" style={menuItemBase} onClick={() => closeAnd(p.onRename)}>
              제목 변경
            </button>
          ) : null}
          {p.showAiSettings && p.onAiSettings ? (
            <button
              type="button"
              role="menuitem"
              style={menuItemBase}
              onClick={() => {
                const openAi = p.onAiSettings;
                if (openAi) closeAnd(openAi);
              }}
            >
              대화 설정
            </button>
          ) : null}
          {p.showAiSummarize && p.onAiSummarize ? (
            <button
              type="button"
              role="menuitem"
              style={p.aiSummarizeDisabled ? menuItemDisabled : menuItemBase}
              disabled={p.aiSummarizeDisabled}
              onClick={() => {
                if (p.aiSummarizeDisabled) return;
                const fn = p.onAiSummarize;
                if (fn) closeAnd(fn);
              }}
            >
              AI요약 정리하기
            </button>
          ) : null}
          {p.showProjectApply && p.onProjectApply ? (
            <button
              type="button"
              role="menuitem"
              style={
                p.projectApplyDisabled
                  ? { ...menuItemDisabled, whiteSpace: "normal", lineHeight: 1.35 }
                  : { ...menuItemBase, whiteSpace: "normal", lineHeight: 1.35 }
              }
              disabled={p.projectApplyDisabled}
              onClick={() => {
                if (p.projectApplyDisabled) return;
                const fn = p.onProjectApply;
                if (fn) closeAnd(fn);
              }}
            >
              현재 대화를 프로젝트로 전환
            </button>
          ) : null}
          {p.showLeave ? (
            <button
              type="button"
              role="menuitem"
              style={{ ...menuItemBase, color: t.textSecondary }}
              onClick={() => closeAnd(p.onLeave)}
            >
              나가기
            </button>
          ) : null}
          {p.showDelete ? (
            <button
              type="button"
              role="menuitem"
              style={{ ...menuItemBase, color: "#b91c1c" }}
              onClick={() => closeAnd(p.onDelete)}
            >
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
