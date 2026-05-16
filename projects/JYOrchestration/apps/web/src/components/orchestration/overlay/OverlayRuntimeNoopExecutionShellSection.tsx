"use client";

import type { OverlayRuntimeNoopExecutionShellSectionVM } from "@/lib/overlay-ui/overlayRuntimeNoopExecutionShellAdapter";
import {
  RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeNoopExecutionShell/runtimeNoopExecutionShellLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

export function OverlayRuntimeNoopExecutionShellSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeNoopExecutionShellSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime No-op Execution Shell Candidate (H31)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Execution shell candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Shell mode" value={vm.shellModeKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top shell blocker / forbidden op" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenShellOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden shell operation" value={vm.topForbiddenShellOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Shell policy" value={vm.shellPolicySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Shell scope</div>
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.scope} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Forbidden shell operations</div>
            {vm.forbiddenShellOperationRows.length > 0 ? (
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
                {vm.forbiddenShellOperationRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.forbiddenOperation} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.checklist} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Missing checklist rows</div>
            {vm.missingChecklistRows.length > 0 ? (
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
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.missingRow} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>Shell blockers</div>
            {vm.shellBlockerRows.length > 0 ? (
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
                {vm.shellBlockerRows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ) : (
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.blocker} />
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
              <OverlayUiEmptyHint message={RUNTIME_NOOP_EXECUTION_SHELL_EMPTY_HINT_KO.recommendation} />
            )}
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_NOOP_EXECUTION_SHELL_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}


