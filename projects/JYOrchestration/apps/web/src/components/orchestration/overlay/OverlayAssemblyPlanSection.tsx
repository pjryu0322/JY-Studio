"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { OverlayUiAssemblyPlanSectionVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { OVERLAY_UI_PLANNING_DISCLAIMER } from "@/lib/overlay-ui/overlayUiDescription";
import { OverlayUiBadge, OverlayUiEmptyHint, OverlayUiSection } from "./OverlayUiPrimitives";

export function OverlayAssemblyPlanSection({ vm }: { readonly vm: OverlayUiAssemblyPlanSectionVM }) {
  return (
    <OverlayUiSection title="조립 계획" description={OVERLAY_UI_PLANNING_DISCLAIMER}>
      {!vm.hasData ? (
        <OverlayUiEmptyHint message="조립 계획 정보가 기록되지 않았습니다." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {vm.byIncludeMode.required > 0 ? (
              <OverlayUiBadge tone="info" title="핵심 맥락으로 우선 참조">
                핵심 {vm.byIncludeMode.required}
              </OverlayUiBadge>
            ) : null}
            {vm.byIncludeMode.recommended > 0 ? (
              <OverlayUiBadge tone="neutral" title="추천 맥락">
                추천 {vm.byIncludeMode.recommended}
              </OverlayUiBadge>
            ) : null}
            {vm.byIncludeMode.optional > 0 ? (
              <OverlayUiBadge tone="neutral" title="선택 맥락">
                선택 {vm.byIncludeMode.optional}
              </OverlayUiBadge>
            ) : null}
            {vm.byIncludeMode.excludeCandidate > 0 ? (
              <OverlayUiBadge tone="warning" title="축소 후보(실제 제거 아님)">
                축소 후보 {vm.byIncludeMode.excludeCandidate}
              </OverlayUiBadge>
            ) : null}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {vm.rows.map((row, i) => (
              <li
                key={`pl-${i}`}
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  padding: "8px 10px",
                  background: "#fff",
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
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
                    추정 비용 {row.estimatedCost.toLocaleString("ko-KR")}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, wordBreak: "break-all" }}>
                  출처: <span style={{ color: t.textSecondary }}>{row.source}</span>
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                  {row.includeModeDescription}
                  {row.includeReason ? ` (${row.includeReason})` : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </OverlayUiSection>
  );
}
