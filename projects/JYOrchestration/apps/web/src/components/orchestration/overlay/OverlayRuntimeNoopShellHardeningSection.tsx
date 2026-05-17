"use client";

import type { OverlayRuntimeNoopShellHardeningSectionVM } from "@/lib/overlay-ui/overlayRuntimeNoopShellHardeningAdapter";
import {
  RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO,
  RUNTIME_NOOP_SHELL_HARDENING_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeNoopShellHardening/runtimeNoopShellHardeningLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeNoopShellHardeningSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeNoopShellHardeningSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime No-op Shell Hardening (H33)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Shell hardening readiness" value={vm.hardeningReadinessKo} />
        <OverlayUiKeyValueRow label="Hardening mode" value={vm.hardeningModeKo} />
        <OverlayUiKeyValueRow label="Contract verification" value={vm.contractVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Preflight readiness" value={vm.preflightReadinessKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H34 entry readiness" value={vm.h34EntryReadinessKo} />
        <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top violation / blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        <OverlayUiKeyValueRow label="No-execution result" value={vm.noExecutionResultSummaryKo} />
        {!vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Safety guard" value={vm.safetyGuardSummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Safety guard" value={vm.safetyGuardSummaryKo} />
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Hardening contract</div>
            {vm.contractRowSample.length > 0 ? (
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
                {vm.contractRowSample.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.contract} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.inputEnvelope} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.outputEnvelope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Safety guard rows</div>
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.guard} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.boundaryViolation} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.contractFinding} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.readinessFinding} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.alignmentFinding} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Final safety gate checklist</div>
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.finalGateChecklist} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.preflightChecklist} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Hardening blockers</div>
            {vm.hardeningBlockerRows.length > 0 ? (
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
                {vm.hardeningBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.blocker} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_NOOP_SHELL_HARDENING_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
