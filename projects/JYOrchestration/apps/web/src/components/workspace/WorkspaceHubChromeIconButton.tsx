"use client";

import type { ReactNode } from "react";
import { uiTokens as t } from "@/components/ui";

const badgeStyle = {
  position: "absolute" as const,
  top: 2,
  right: 2,
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 999,
  background: "#0ea5e9",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "1.5px solid #fff",
  lineHeight: 1,
  boxSizing: "border-box" as const,
  pointerEvents: "none" as const,
};

/**
 * 요구사항 허브·메신저 등에서 쓰는 34px 테두리 아이콘 버튼(선택적 숫자 배지).
 */
export function WorkspaceHubChromeIconButton({
  title,
  ariaLabel,
  disabled,
  onClick,
  children,
  badge,
  badgeTone = "default",
  emphasisTone = "default",
  buttonRef,
}: {
  readonly title: string;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly onClick: () => void | Promise<void>;
  readonly children: ReactNode;
  readonly badge?: number | null;
  /** stale artifact 등 강조 배지 */
  readonly badgeTone?: "default" | "stale";
  /** 구현 빠른 실행 등 선택 강조 */
  readonly emphasisTone?: "default" | "amber" | "danger";
  readonly buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  const amberActive = emphasisTone === "amber" && !disabled;
  const dangerActive = emphasisTone === "danger" && !disabled;
  return (
    <button
      ref={buttonRef}
      type="button"
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onClick();
      }}
      style={{
        position: "relative",
        width: 34,
        height: 34,
        borderRadius: 10,
        border: dangerActive ? "1px solid #fecaca" : amberActive ? "1px solid #ca8a04" : "1px solid #e2e8f0",
        background: disabled ? "#f8fafc" : dangerActive ? "#fef2f2" : amberActive ? "#facc15" : "#fff",
        color: disabled ? t.textMuted : dangerActive ? "#b91c1c" : amberActive ? "#713f12" : "#0f172a",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 ? (
        <span
          style={{
            ...badgeStyle,
            ...(badgeTone === "stale" ? { background: "#d97706" } : {}),
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function WorkspaceHubUsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
