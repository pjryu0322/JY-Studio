"use client";

import type { OverlayRuntimePilotContractSectionVM } from "@/lib/overlay-ui/overlayRuntimePilotContractAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimePilotContractSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePilotContractSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Pilot Contract & Adapter Boundary (H24.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Contract readiness" value={vm.contractReadinessKo} />
        <OverlayUiKeyValueRow label="Adapter boundary" value={vm.adapterBoundaryModeKo} />
        <OverlayUiKeyValueRow label="Handoff readiness" value={vm.handoffReadinessKo} />
        {vm.topHandoffBlocker ? (
          <OverlayUiKeyValueRow label="Top handoff blocker" value={vm.topHandoffBlocker} />
        ) : null}
        {vm.topForbiddenOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>
              Input contract requirements (schema meta)
            </div>
            {vm.inputRequirementRows.length > 0 ? (
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
                {vm.inputRequirementRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Input requirement 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>
              Output contract expectations (schema meta)
            </div>
            {vm.outputExpectationRows.length > 0 ? (
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
                {vm.outputExpectationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Output expectation 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Handoff blockers</div>
            {vm.handoffBlockerRows.length > 0 ? (
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
                {vm.handoffBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Handoff blocker 없음" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>
              Forbidden adapter operations
            </div>
            {vm.forbiddenOperationRows.length > 0 ? (
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
                {vm.forbiddenOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Forbidden operation 목록 없음" />
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
          actual runtime adapter invocation·execution·routing·rollback·prompt 변경은 없습니다.
        </div>
      </div>
    </OverlayUiSection>
  );
}
