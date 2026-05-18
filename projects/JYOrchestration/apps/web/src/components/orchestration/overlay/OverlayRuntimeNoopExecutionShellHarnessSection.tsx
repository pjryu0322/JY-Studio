"use client";

import type { OverlayRuntimeNoopExecutionShellHarnessSectionVM } from "@/lib/overlay-ui/overlayRuntimeNoopExecutionShellHarnessAdapter";
import {
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeNoopExecutionShellHarness/runtimeNoopExecutionShellHarnessLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeNoopExecutionShellHarnessSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeNoopExecutionShellHarnessSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime No-op Execution Shell Harness (H32)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Execution shell harness readiness" value={vm.harnessReadinessKo} />
        <OverlayUiKeyValueRow label="Harness mode" value={vm.harnessModeKo} />
        <OverlayUiKeyValueRow label="Preflight readiness" value={vm.preflightReadinessKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top harness blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Contract boundary" value={vm.contractBoundarySummaryKo} />
            <OverlayUiKeyValueRow label="Input envelope" value={vm.inputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="Output envelope" value={vm.outputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="No-op result" value={vm.noopResultSummaryKo} />
            <OverlayUiKeyValueRow label="Safety guard" value={vm.safetyGuardSummaryKo} />
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Contract boundary</div>
            {vm.contractBoundaryRows.length > 0 ? (
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
                {vm.contractBoundaryRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.contractBoundary} />
            )}
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.inputEnvelope} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.outputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Safety guard</div>
            {vm.guardRows.length > 0 ? (
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
                {vm.guardRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.guard} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Harness blockers</div>
            {vm.harnessBlockerRows.length > 0 ? (
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
                {vm.harnessBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.blocker} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.preflightChecklist} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
