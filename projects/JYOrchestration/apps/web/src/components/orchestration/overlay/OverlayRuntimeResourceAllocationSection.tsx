"use client";

import type { OverlayRuntimeResourceAllocationSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceAllocationAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeResourceAllocationSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeResourceAllocationSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Resource Allocation Planning (H21.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Global allocation mode" value={vm.globalAllocationModeKo} />
        <OverlayUiKeyValueRow label="Eligibility (effective)" value={vm.eligibilityEffectiveKo} />
        <OverlayUiKeyValueRow label="Execution candidate" value={vm.executionCandidateKo} />
        <OverlayUiKeyValueRow label="Governance boundary link" value={vm.governanceBoundaryKo} />
        <OverlayUiKeyValueRow label="Provider slot hint" value={vm.providerHintKo} />
        <OverlayUiKeyValueRow label="Provider pressure link" value={vm.providerLinkKo} />
        <OverlayUiKeyValueRow label="Execution slot hint" value={vm.executionHintKo} />
        <OverlayUiKeyValueRow label="Queue / bottleneck" value={vm.queueBottleneckKo} />
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Member allocation rows</div>
            {vm.memberRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.memberRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Member allocation row 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Recommendations</div>
            {vm.recommendationRows.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: t.textMuted,
                  lineHeight: 1.45,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {vm.recommendationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Recommendation 없음" />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime orchestration·resource allocation·provider switching·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
