"use client";

/**
 * Overlay Observability UI — 공통 시각 primitive(Badge, Section, RowCard).
 *
 * read-only 시각 컴포넌트. enforcement·routing 어디에도 영향 없음.
 */

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

const ROW_CARD_BASE_STYLE: CSSProperties = {
  fontSize: 12,
  color: t.textSecondary,
  background: "#fff",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  padding: "6px 10px",
};

const BADGE_TONE_STYLES: Readonly<Record<OverlayUiBadgeTone, { background: string; color: string; border: string }>> = {
  neutral: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  info: { background: "rgba(59,130,246,0.12)", color: "#1d4ed8", border: "#bfdbfe" },
  positive: { background: "rgba(34,197,94,0.15)", color: "#166534", border: "#bbf7d0" },
  warning: { background: "rgba(251,191,36,0.18)", color: "#92400e", border: "#fde68a" },
  danger: { background: "rgba(239,68,68,0.15)", color: "#991b1b", border: "#fecaca" },
};

export function OverlayUiBadge({
  tone = "neutral",
  children,
  title,
}: {
  readonly tone?: OverlayUiBadgeTone;
  readonly children: ReactNode;
  readonly title?: string;
}) {
  const s = BADGE_TONE_STYLES[tone];
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 800,
        padding: "2px 8px",
        borderRadius: 999,
        background: s.background,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function OverlayUiSection({
  title,
  description,
  children,
  defaultOpen = true,
  collapsible = true,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly collapsible?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <summary
        style={{
          cursor: collapsible ? "pointer" : "default",
          listStyle: collapsible ? undefined : "none",
          outline: "none",
          fontSize: 12,
          fontWeight: 900,
          color: t.textPrimary,
        }}
      >
        {title}
      </summary>
      {description ? (
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginTop: 6, marginBottom: 8, lineHeight: 1.5 }}>
          {description}
        </div>
      ) : null}
      <div style={{ marginTop: 6 }}>{children}</div>
    </details>
  );
}

export function OverlayUiKeyValueRow({
  label,
  value,
  badge,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly badge?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "4px 0",
        fontSize: 12,
        color: t.textSecondary,
      }}
    >
      <span style={{ color: t.textMuted, fontWeight: 700 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {value}
        {badge}
      </span>
    </div>
  );
}

/**
 * Section 내부에서 반복 사용되는 "흰 카드형 행"을 통일한다.
 * - 기본 layout은 column. flex direction/align/gap 등은 `layout` prop으로 override.
 */
export function OverlayUiRowCard({
  children,
  layout,
}: {
  readonly children: ReactNode;
  readonly layout?: Pick<
    CSSProperties,
    "display" | "flexDirection" | "alignItems" | "justifyContent" | "gap" | "flexWrap"
  >;
}) {
  return (
    <li
      style={{
        ...ROW_CARD_BASE_STYLE,
        display: layout?.display ?? "flex",
        flexDirection: layout?.flexDirection ?? "column",
        alignItems: layout?.alignItems,
        justifyContent: layout?.justifyContent,
        gap: layout?.gap ?? 4,
        flexWrap: layout?.flexWrap,
      }}
    >
      {children}
    </li>
  );
}

/** `<ul>` 기본 스타일 컨테이너. row 간격 통일. */
export function OverlayUiRowList({ children }: { readonly children: ReactNode }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {children}
    </ul>
  );
}

export function OverlayUiEmptyHint({ message }: { readonly message: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: t.textMuted,
        background: "#f8fafc",
        border: `1px dashed ${t.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
