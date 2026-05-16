"use client";

import type { OverlayRuntimeResourceSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeResourceSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeResourceSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Resource Intelligence (H20.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Overload summary" value={vm.overloadSummaryKo} />
        <OverlayUiKeyValueRow label="Primary pressure" value={vm.primaryPressureKo} />
        <OverlayUiKeyValueRow label="Provider pressure" value={vm.providerPressureKo} />
        <OverlayUiKeyValueRow label="Queue pressure" value={vm.queuePressureKo} />
        <OverlayUiKeyValueRow label="Bottleneck propagation" value={vm.bottleneckPropagationKo} />
        <OverlayUiKeyValueRow label="Queue depth" value={vm.queueDepthLabel} />
        <OverlayUiKeyValueRow label="Capacity outlook" value={vm.capacityOutlookLabel} />
        <OverlayUiKeyValueRow label="Capacity forecast" value={vm.capacityForecastKo} />
        <OverlayUiKeyValueRow label="Member saturation" value={vm.memberSaturationKo} />
        <OverlayUiKeyValueRow label="Resource explainability" value={vm.explainabilityChainKo} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Resource pressure</div>
        {vm.pressureRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45, overflowWrap: "anywhere" as const }}>
            {vm.pressureRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Pressure 없음" />
        )}
        {vm.showDetailSections ? (
          <details style={{ fontSize: 11, color: t.textMuted }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>AI member workload</summary>
            {vm.memberRows.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45, overflowWrap: "anywhere" as const }}>
                {vm.memberRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Member workload 없음" />
            )}
          </details>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·provider switching·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
