"use client";

import type { OverlayRuntimePilotActivationSectionVM } from "@/lib/overlay-ui/overlayRuntimePilotActivationAdapter";
import {
  RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO,
  RUNTIME_PILOT_ACTIVATION_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimePilotActivation/runtimePilotActivationLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimePilotActivationSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePilotActivationSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Pilot Activation Candidate (H27)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Activation candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Activation mode" value={vm.activationModeKo} />
        {vm.topActivationBlocker ? (
          <OverlayUiKeyValueRow label="Top activation blocker" value={vm.topActivationBlocker} />
        ) : null}
        {!vm.topActivationBlocker && vm.topForbiddenActivationOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenActivationOperation} />
        ) : null}
        <OverlayUiKeyValueRow label="Activation policy" value={vm.activationPolicySummaryKo} />
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Activation scope</div>
            {vm.scopeSummaryRows.length > 0 ? (
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
                {vm.scopeSummaryRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO.scope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden activation operations</div>
            {vm.forbiddenActivationOperationRows.length > 0 ? (
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
                {vm.forbiddenActivationOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO.forbiddenOperation} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Readiness checklist</div>
            {vm.readinessChecklistRows.length > 0 ? (
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
                {vm.readinessChecklistRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO.checklist} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Activation blockers</div>
            {vm.activationBlockerRows.length > 0 ? (
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
                {vm.activationBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO.blocker} />
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
              <OverlayUiEmptyHint message={RUNTIME_PILOT_ACTIVATION_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>{RUNTIME_PILOT_ACTIVATION_OVERLAY_FOOTER_KO}</div>
      </div>
    </OverlayUiSection>
  );
}
