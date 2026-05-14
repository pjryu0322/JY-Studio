"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type {
  OverlayUiAssemblyPlanRow,
  OverlayUiAssemblyPlanSectionVM,
} from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_PLANNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import {
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
} from "./OverlayUiPrimitives";
import type { OverlayAssemblyIncludeMode } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

type SummaryBadge = Readonly<{
  mode: OverlayAssemblyIncludeMode;
  label: string;
  tone: OverlayUiBadgeTone;
  title: string;
}>;

const SUMMARY_BADGES: readonly SummaryBadge[] = [
  { mode: "required", label: "핵심", tone: "info", title: "핵심 맥락으로 우선 참조" },
  { mode: "recommended", label: "추천", tone: "neutral", title: "추천 맥락" },
  { mode: "optional", label: "선택", tone: "neutral", title: "선택 맥락" },
  { mode: "excludeCandidate", label: "축소 후보", tone: "warning", title: "축소 후보(실제 제거 아님)" },
];

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function PlanItemCard({ row }: { readonly row: OverlayUiAssemblyPlanRow }) {
  return (
    <OverlayUiRowCard layout={{ gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ color: t.textPrimary }}>{row.typeLabel}</strong>
        <OverlayUiBadge tone={row.includeModeTone} title={row.includeModeDescription}>
          {row.includeModeLabel}
        </OverlayUiBadge>
        {row.pruningCandidate ? (
          <OverlayUiBadge tone="warning" title="중요도가 낮아 축소 후보로 분류">
            축소 후보
          </OverlayUiBadge>
        ) : null}
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>
          추정 비용 {fmt(row.estimatedCost)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>
        출처: <span style={{ color: t.textSecondary }}>{row.source}</span>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        {row.includeModeDescription}
        {row.includeReason ? ` (${row.includeReason})` : null}
      </div>
    </OverlayUiRowCard>
  );
}

export function OverlayAssemblyPlanSection({ vm }: { readonly vm: OverlayUiAssemblyPlanSectionVM }) {
  return (
    <OverlayUiSection title="조립 계획" description={OVERLAY_UI_PLANNING_DISCLAIMER}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="조립 계획 정보가 기록되지 않았습니다." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {SUMMARY_BADGES.map((b) =>
              vm.byIncludeMode[b.mode] > 0 ? (
                <OverlayUiBadge key={b.mode} tone={b.tone} title={b.title}>
                  {b.label} {vm.byIncludeMode[b.mode]}
                </OverlayUiBadge>
              ) : null
            )}
          </div>
          <OverlayUiRowList>
            {vm.rows.map((row, i) => (
              <PlanItemCard key={`pl-${i}`} row={row} />
            ))}
          </OverlayUiRowList>
        </>
      )}
    </OverlayUiSection>
  );
}
