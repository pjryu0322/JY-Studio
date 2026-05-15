"use client";

import type { OverlayRuntimeStabilitySectionVM } from "@/lib/overlay-ui/overlayRuntimeStabilityAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeStabilitySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeStabilitySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Stability (H12)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Stability 수준" value={vm.stabilityLevelLabel} />
        <OverlayUiKeyValueRow label="후보 충돌 심각도" value={vm.conflictSeverityLabel} />
        <OverlayUiKeyValueRow label="Saturation" value={vm.saturationLevelLabel} />
        <OverlayUiKeyValueRow label="Governance 안정성" value={vm.unstableGovernanceNote} />
        <OverlayUiKeyValueRow label="Explainability 안정성" value={vm.unstableExplainabilityNote} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>후보 충돌</div>
        {vm.conflictRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.conflictRows.map((r, i) => (
              <li key={`cf-${i}`}>
                <span style={{ fontWeight: 700 }}>{r.title}</span> ({r.severityLabel}) — {r.note}
              </li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="관측된 후보 충돌 없음" />
        )}
        <OverlayUiKeyValueRow label="Critical dependency" value={vm.criticalDependencies.join(" · ") || "—"} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>위험 요인</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
          {vm.riskFactors.map((n, i) => (
            <li key={`rf-${i}`}>{n}</li>
          ))}
        </ul>
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime enforcement·provider routing·rollback 실행은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
