"use client";

import type { OverlayRuntimeSemanticGraphSectionVM } from "@/lib/overlay-ui/overlayRuntimeSemanticGraphAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeSemanticGraphSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeSemanticGraphSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Semantic Explainability Graph (H18)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Explosion risk" value={vm.explosionRiskLabel} />
        <OverlayUiKeyValueRow label="Primary origin" value={vm.primaryOriginChainLabel} />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Causal paths</div>
        {vm.causalPathRows.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.causalPathRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="Causal path 없음" />
        )}
        {vm.showDetailSections ? (
          <details style={{ fontSize: 11, color: t.textMuted }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Warning origins</summary>
            {vm.warningOriginRows.length > 0 ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.45 }}>
                {vm.warningOriginRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Warning origin 없음" />
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
