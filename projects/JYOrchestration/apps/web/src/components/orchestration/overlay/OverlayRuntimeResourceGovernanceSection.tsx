"use client";

import type { OverlayRuntimeResourceGovernanceSectionVM } from "@/lib/overlay-ui/overlayRuntimeResourceGovernanceAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeResourceGovernanceSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeResourceGovernanceSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Resource Governance (H21)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Governance risk" value={vm.governanceRiskKo} />
        <OverlayUiKeyValueRow label="Governance mode" value={vm.governanceModeKo} />
        <OverlayUiKeyValueRow label="Operator review" value={vm.operatorReviewKo} />
        <OverlayUiKeyValueRow label="Control boundary" value={vm.controlBoundaryKo} />
        <OverlayUiKeyValueRow label="Allocation readiness" value={vm.allocationReadinessKo} />
        <OverlayUiKeyValueRow label="Policy violation candidate" value={vm.policyViolationKo} />
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Policy findings</div>
            {vm.findingRows.length > 0 ? (
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
                {vm.findingRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Policy finding 없음" />
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
          actual runtime orchestration·provider switching·payload 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
