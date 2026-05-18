"use client";

import type { OverlayRuntimeDecisionSectionVM } from "@/lib/overlay-ui/overlayRuntimeDecisionAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeDecisionSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeDecisionSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Decision Intelligence (H19.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Primary recommendation" value={vm.primaryRecommendationKo} />
        <OverlayUiKeyValueRow label="Routing implication" value={vm.routingImplicationKo} />
        <OverlayUiKeyValueRow label="Coherence" value={vm.coherenceLabel} />
        <OverlayUiKeyValueRow label="Snapshot" value={vm.snapshotSummaryKo} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Decision lineage</div>
        {vm.lineagePathRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.lineagePathRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Lineage path 없음" />
        )}
        {vm.showDetailSections ? (
          <details style={{ fontSize: 11, color: t.textMuted }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Recommendations</summary>
            {vm.recommendationRows.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                {vm.recommendationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Recommendation 없음" />
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
