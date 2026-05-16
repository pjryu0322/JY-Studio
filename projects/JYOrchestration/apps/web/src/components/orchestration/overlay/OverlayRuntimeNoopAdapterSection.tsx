"use client";

import type { OverlayRuntimeNoopAdapterSectionVM } from "@/lib/overlay-ui/overlayRuntimeNoopAdapterAdapter";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeNoopAdapterSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeNoopAdapterSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="No-op Runtime Adapter Skeleton (H25)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="No-op adapter status" value={vm.noopAdapterStatusKo} />
        <OverlayUiKeyValueRow label="Invocation guard" value={vm.invocationGuardKo} />
        <OverlayUiKeyValueRow label="Contract verification" value={vm.contractVerificationStatusKo} />
        {vm.topViolation ? <OverlayUiKeyValueRow label="Top violation" value={vm.topViolation} /> : null}
        {vm.topForbiddenOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>No-op result metadata</div>
            {vm.noopResultRows.length > 0 ? (
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
                {vm.noopResultRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="No-op result ???" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Skeleton contract inputs</div>
            {vm.skeletonInputRows.length > 0 ? (
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
                {vm.skeletonInputRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Skeleton input ???" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Boundary violations</div>
            {vm.violationRows.length > 0 ? (
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
                {vm.violationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message="Boundary violation ???" />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden operations</div>
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
              <OverlayUiEmptyHint message="Forbidden operation ???" />
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
              <OverlayUiEmptyHint message="Recommendation ???" />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          actual runtime adapter invocation?execution?routing?rollback?prompt ???? ??????.
        </div>
      </div>
    </OverlayUiSection>
  );
}

