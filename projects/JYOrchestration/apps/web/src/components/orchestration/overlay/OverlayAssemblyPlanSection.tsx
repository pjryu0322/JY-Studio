"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type {
  OverlayUiAssemblyPlanRow,
  OverlayUiAssemblyPlanSectionVM,
} from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_PLANNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import { formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import {
  OVERLAY_INCLUDE_MODE_ORDER,
  OverlayIncludeModeBadge,
  OverlayUiBadge,
  OverlayUiEmptyHint,
  OverlayUiRowCard,
  OverlayUiRowList,
  OverlayUiSection,
  OverlayUiSourceText,
} from "./OverlayUiPrimitives";

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
          추정 비용 {formatKoreanInt(row.estimatedCost)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
        <span style={{ flexShrink: 0 }}>출처:</span>
        <OverlayUiSourceText source={row.source} />
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        {row.includeModeDescription}
        {row.includeReason ? ` (${row.includeReason})` : null}
      </div>
    </OverlayUiRowCard>
  );
}

export function OverlayAssemblyPlanSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayUiAssemblyPlanSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection title="조립 계획" description={OVERLAY_UI_PLANNING_DISCLAIMER} defaultOpen={defaultOpen}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="조립 계획 정보가 기록되지 않았습니다." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {OVERLAY_INCLUDE_MODE_ORDER.map((mode) => (
              <OverlayIncludeModeBadge key={mode} mode={mode} count={vm.byIncludeMode[mode]} />
            ))}
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
