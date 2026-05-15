"use client";

import type { OverlayRuntimeTrialSectionVM } from "@/lib/overlay-ui/overlayRuntimeTrialAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeTrialSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeTrialSectionVM;
  readonly defaultOpen?: boolean;
}) {
  const hasUnstable = vm.unstableLayerLabelsKo.length > 0;

  return (
    <OverlayUiSection title="통제 런타임 시험 준비 (H10)" description={vm.sectionDisclaimer} defaultOpen={defaultOpen}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="준비도" value={vm.readinessLevelLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>{vm.unstableLayersHeading}</div>
        {hasUnstable ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: t.textSecondary, lineHeight: 1.45 }}>
            {vm.unstableLayerLabelsKo.map((label, i) => (
              <li key={`${i}-${label}`}>{label}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message={vm.unstableEmptyLabel} />
        )}
        <OverlayUiKeyValueRow label="런타임 리스크(휴리스틱)" value={vm.riskOverallLabel} />
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.riskFactors.map((f, i) => (
            <li key={`rf-${i}`}>{f}</li>
          ))}
        </ul>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>{vm.simulationDisclaimer}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>시뮬레이션 항목(모두 비실행)</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.simulatedActionLabels.map((label, i) => (
            <li key={`sim-${i}`}>
              {label} — <strong>아니오</strong>
            </li>
          ))}
        </ul>
      </div>
    </OverlayUiSection>
  );
}
