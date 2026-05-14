"use client";

/**
 * Overlay Observability UI — 공통 시각 primitive(Badge alias, Section, RowCard).
 *
 * read-only 시각 컴포넌트. enforcement·routing 어디에도 영향 없음.
 */

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  overlayUiIncludeModeBadgeTitle,
  overlayUiIncludeModeLabel,
  overlayUiIncludeModeTone,
  type OverlayUiBadgeTone,
} from "@/lib/overlay-ui/overlayUiLabel";
import type { OverlayAssemblyIncludeMode } from "@/lib/overlay/overlayContextAssemblyPlan";

const ROW_CARD_BASE_STYLE: CSSProperties = {
  fontSize: 12,
  color: t.textSecondary,
  background: "#fff",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  padding: "6px 10px",
};

/**
 * Overlay tone → 공통 Badge variant 매핑.
 * - `positive`는 공통 Badge의 `success`와 의미적으로 동일.
 * - 나머지는 직매핑이라 시각적 가시성이 통일된다.
 */
const TONE_TO_VARIANT: Readonly<Record<OverlayUiBadgeTone, BadgeVariant>> = {
  neutral: "neutral",
  info: "info",
  positive: "success",
  warning: "warning",
  danger: "danger",
};

/**
 * Overlay UI 용 Badge — 공통 `Badge` primitive에 위임한다.
 *
 * Overlay 도메인의 tone 어휘를 그대로 유지하면서 시각은 공통 Badge로 통일.
 */
export function OverlayUiBadge({
  tone = "neutral",
  children,
  title,
}: {
  readonly tone?: OverlayUiBadgeTone;
  readonly children: ReactNode;
  readonly title?: string;
}) {
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} title={title} style={{ whiteSpace: "nowrap", gap: 4 }}>
      {children}
    </Badge>
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

/**
 * includeMode 배지 노출 순서(중요도 ↓). SummaryHeader / AssemblyPlan에서 공통 사용.
 */
export const OVERLAY_INCLUDE_MODE_ORDER: readonly OverlayAssemblyIncludeMode[] = [
  "required",
  "recommended",
  "optional",
  "excludeCandidate",
];

/**
 * includeMode(`핵심/추천/선택/축소 후보`) 단일 배지.
 *
 * tone/label/title이 `overlayUiLabel`의 **단일 매핑**에서 일관되게 도출된다.
 * SummaryHeader, AssemblyPlan 그룹/row 등 모든 includeMode 배지의 공통 진입점.
 *
 * - `count`가 주어지면 라벨 뒤에 숫자가 붙는다("핵심 3"). 없으면 라벨만("핵심").
 * - `count <= 0`이면 `null`을 반환 — 호출부에서 별도 조건 분기를 줄여준다.
 */
export function OverlayIncludeModeBadge({
  mode,
  count,
  titleOverride,
}: {
  readonly mode: OverlayAssemblyIncludeMode;
  readonly count?: number;
  readonly titleOverride?: string;
}) {
  if (typeof count === "number" && count <= 0) return null;
  const label = overlayUiIncludeModeLabel(mode);
  const tone = overlayUiIncludeModeTone(mode);
  const title = titleOverride ?? overlayUiIncludeModeBadgeTitle(mode);
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} title={title} style={{ whiteSpace: "nowrap", gap: 4 }}>
      {typeof count === "number" ? `${label} ${count}` : label}
    </Badge>
  );
}

/**
 * 긴 source 텍스트를 1줄 ellipsis로 노출하는 공통 원시티브.
 *
 * - `title` hover로 전체 텍스트 노출(native browser tooltip).
 * - `maxWidth`로 모바일/카드 너비 제어 가능.
 * - `min-width: 0`를 강제해 flex 부모 내부에서도 ellipsis가 동작하도록 한다.
 */
export function OverlayUiSourceText({
  source,
  maxWidth,
  style,
}: {
  readonly source: string;
  readonly maxWidth?: number | string;
  readonly style?: CSSProperties;
}) {
  return (
    <span
      title={source}
      style={{
        color: t.textSecondary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0,
        flex: "1 1 auto",
        maxWidth,
        ...style,
      }}
    >
      {source}
    </span>
  );
}

/**
 * Overlay UI — 경고/주의 메시지 리스트(공통). `OverlayWarningSection`, Harness preview 등
 * 여러 위치의 동일한 amber 스타일 목록을 단일 출처로 통합.
 *
 * - role="status" + aria-live="polite"로 스크린리더 친화.
 * - 0건이면 null 반환(상위에서 분기 불필요).
 */
export function OverlayUiWarningList({
  warnings,
  ariaLabel = "Overlay warnings",
}: {
  readonly warnings: readonly string[];
  readonly ariaLabel?: string;
}) {
  if (!warnings.length) return null;
  return (
    <ul
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={{
        listStyle: "none",
        margin: 0,
        padding: "6px 10px",
        background: "#fff7ed",
        border: `1px solid #fdba74`,
        borderRadius: 8,
        color: "#9a3412",
        fontSize: 11,
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {warnings.map((w, i) => (
        <li key={`w-${i}`}>• {w}</li>
      ))}
    </ul>
  );
}

export function OverlayUiEmptyHint({
  message,
  secondary,
}: {
  readonly message: string;
  readonly secondary?: string;
}) {
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
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
      role="status"
      aria-live="polite"
    >
      <span>{message}</span>
      {secondary ? <span style={{ fontSize: 11, color: t.textMuted, opacity: 0.85 }}>{secondary}</span> : null}
    </div>
  );
}
