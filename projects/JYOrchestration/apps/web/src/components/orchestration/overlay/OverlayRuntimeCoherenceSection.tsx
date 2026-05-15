"use client";

import type { OverlayRuntimeCoherenceSectionVM } from "@/lib/overlay-ui/overlayRuntimeCoherenceAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeCoherenceSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeCoherenceSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Coherence (H14)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <OverlayUiKeyValueRow label="Coherence" value={vm.coherenceLabel} />
        <OverlayUiKeyValueRow label="Synchronization" value={vm.synchronizationLabel} />
        <OverlayUiKeyValueRow label="Divergence" value={vm.divergenceSeverityLabel} />
        <OverlayUiKeyValueRow label="Alignment score" value={vm.alignmentScoreLabel} />
        <OverlayUiKeyValueRow
          label="Operator attention"
          value={vm.operatorAttentionRequired ? "필요(메타)" : "불필요(메타)"}
        />
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>불일치 영역</div>
        {vm.misalignedAreas.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            {vm.misalignedAreas.map((a, i) => (
              <li key={`ma-${i}`}>{a}</li>
            ))}
          </ul>
        ) : (
          <OverlayUiEmptyHint message="불일치 영역 없음" />
        )}
        <OverlayUiKeyValueRow label="Lagging layer" value={vm.laggingLayers.join(" · ") || "—"} />
        <OverlayUiKeyValueRow
          label="Stale consistency"
          value={vm.staleConsistencyIssues.slice(0, 2).join(" · ") || "—"}
        />
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·enforcement·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
