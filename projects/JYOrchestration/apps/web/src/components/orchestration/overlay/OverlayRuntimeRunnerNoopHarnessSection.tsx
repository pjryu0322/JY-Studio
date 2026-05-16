"use client";

import type { OverlayRuntimeRunnerNoopHarnessSectionVM } from "@/lib/overlay-ui/overlayRuntimeRunnerNoopHarnessAdapter";
import {
  RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeRunnerNoopHarness/runtimeRunnerNoopHarnessLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeRunnerNoopHarnessSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeRunnerNoopHarnessSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Runner No-op Harness (H30.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="No-op harness readiness" value={vm.harnessReadinessKo} />
        <OverlayUiKeyValueRow label="Harness mode" value={vm.harnessModeKo} />
        <OverlayUiKeyValueRow label="Contract verification" value={vm.contractVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Preflight readiness" value={vm.preflightReadinessKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H31 entry readiness" value={vm.h31EntryReadinessKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top violation / blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
            <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
            <OverlayUiKeyValueRow label="No-op result summary" value={vm.noopResultSummaryKo} />
            <OverlayUiKeyValueRow label="Safety guard summary" value={vm.safetyGuardSummaryKo} />
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Invocation envelope</div>
            {vm.envelopeRows.length > 0 ? (
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
                {vm.envelopeRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.envelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>No-op result metadata</div>
            {vm.resultRows.length > 0 ? (
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
                {vm.resultRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.result} />
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
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.guard} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Boundary violations</div>
            {vm.boundaryViolationRows.length > 0 ? (
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
                {vm.boundaryViolationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.boundaryViolation} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Contract verification findings</div>
            {vm.contractFindingRows.length > 0 ? (
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
                {vm.contractFindingRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.contractFinding} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Readiness verification findings</div>
            {vm.readinessFindingRows.length > 0 ? (
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
                {vm.readinessFindingRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.harnessReadinessFinding} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Alignment findings</div>
            {vm.alignmentFindingRows.length > 0 ? (
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
                {vm.alignmentFindingRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.alignmentFinding} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Final gate checklist</div>
            {vm.finalGateChecklistRows.length > 0 ? (
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
                {vm.finalGateChecklistRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.finalGateChecklist} />
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
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.preflightChecklist} />
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
              <OverlayUiEmptyHint message={RUNTIME_RUNNER_NOOP_HARNESS_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_RUNNER_NOOP_HARNESS_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
