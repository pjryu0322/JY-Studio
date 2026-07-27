"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared Admin panel toolbar controls — same glyph + button chrome for
 * 접기/펼치기, 새로고침, 다운로드, 저장 across generation / preflight / runs.
 */

const ICON_BTN_BASE =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-50";
const ICON_BTN_DEFAULT =
  "border-store-border bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800";
const ICON_BTN_ACCENT =
  "border-sky-600 bg-store-accent text-white hover:bg-sky-700";

export function AdminPanelIconButton({
  title,
  onClick,
  disabled,
  accent = false,
  children,
  className = "",
  ...rest
}: {
  readonly title: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly accent?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children" | "className">) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${ICON_BTN_BASE} ${accent ? ICON_BTN_ACCENT : ICON_BTN_DEFAULT} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Chevron: down when collapsed (펼치기), up when expanded (접기). */
export function AdminPanelCollapseIcon({
  collapsed,
  className = "h-4 w-4",
}: {
  readonly collapsed: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {collapsed ? (
        <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 12l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function AdminPanelRefreshIcon({
  spinning = false,
  className = "h-4 w-4",
}: {
  readonly spinning?: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`${className}${spinning ? " animate-spin" : ""}`}
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M16 10a6 6 0 1 1-1.7-4.2" strokeLinecap="round" />
      <path d="M16 3.5V7h-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminPanelDownloadIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M10 3v9" strokeLinecap="round" />
      <path d="M6.5 9.5L10 13l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16.5h12" strokeLinecap="round" />
    </svg>
  );
}

export function AdminPanelSaveIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M4 4h9.5L16 6.5V16H4V4z" strokeLinejoin="round" />
      <path d="M7 4v4h6V4" strokeLinejoin="round" />
      <path d="M7 16v-4h6v4" strokeLinejoin="round" />
    </svg>
  );
}
