"use client";

import type { OverlayRuntimeReleaseGatePreflightSectionVM } from "@/lib/overlay-ui/overlayRuntimeReleaseGatePreflightAdapter";
import {
  RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeReleaseGatePreflightSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeReleaseGatePreflightSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Release-Gate Final Preflight (H35)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Preflight readiness" value={vm.preflightReadinessKo} />
        <OverlayUiKeyValueRow label="Preflight mode" value={vm.preflightModeKo} />
        {vm.topPreflightBlocker ? (
          <OverlayUiKeyValueRow label="Top preflight blocker" value={vm.topPreflightBlocker} />
        ) : null}
        {!vm.topPreflightBlocker && vm.topForbiddenBoundaryOperation ? (
          <OverlayUiKeyValueRow
            label="Top forbidden boundary operation"
            value={vm.topForbiddenBoundaryOperation}
          />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Execution readiness boundary" value={vm.boundarySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Input envelope</div>
            {vm.inputEnvelopeRows.length > 0 ? (
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
                {vm.inputEnvelopeRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.inputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Output envelope</div>
            {vm.outputEnvelopeRows.length > 0 ? (
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
                {vm.outputEnvelopeRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.outputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>
              Forbidden boundary operations
            </div>
            {vm.forbiddenBoundaryOperationRows.length > 0 ? (
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
                {vm.forbiddenBoundaryOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.forbiddenOperation} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>No-execution proof</div>
            {vm.noExecutionProofRows.length > 0 ? (
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
                {vm.noExecutionProofRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>
              Operation-forbidden proof
            </div>
            {vm.operationForbiddenProofRows.length > 0 ? (
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
                {vm.operationForbiddenProofRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Preflight checklist</div>
            {vm.preflightChecklistRows.length > 0 ? (
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
                {vm.preflightChecklistRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.checklist} />
            )}
            {vm.missingChecklistRows.length > 0 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Missing checklist</div>
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
                  {vm.missingChecklistRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Preflight blockers</div>
            {vm.preflightBlockerRows.length > 0 ? (
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
                {vm.preflightBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.blocker} />
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
              <OverlayUiEmptyHint message={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
