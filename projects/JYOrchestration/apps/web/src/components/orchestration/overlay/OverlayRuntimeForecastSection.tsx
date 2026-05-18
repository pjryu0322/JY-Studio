"use client";

import type { OverlayRuntimeForecastSectionVM } from "@/lib/overlay-ui/overlayRuntimeForecastAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeForecastSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeForecastSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Forecasting (H20)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Primary forecast" value={vm.primaryForecastKo} />
        <OverlayUiKeyValueRow label="Saturation risk" value={vm.saturationRiskKo} />
        <OverlayUiKeyValueRow label="Stability outlook" value={vm.stabilityOutlookLabel} />
        <OverlayUiKeyValueRow label="Governance drift" value={vm.governanceDriftKo} />
        <OverlayUiKeyValueRow label="Escalation summary" value={vm.escalationSummaryKo} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forecast trends</div>
        {vm.trendRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.trendRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Trend 없음" />
        )}
        {vm.showDetailSections ? (
          <details style={{ fontSize: 11, color: t.textMuted }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Escalation chains</summary>
            {vm.escalationRows.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                {vm.escalationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Escalation chain 없음" />
            )}
          </details>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
