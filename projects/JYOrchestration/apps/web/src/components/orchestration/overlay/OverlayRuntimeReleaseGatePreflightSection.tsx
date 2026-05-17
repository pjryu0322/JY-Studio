"use client";

import type { OverlayRuntimeReleaseGatePreflightSectionVM } from "@/lib/overlay-ui/overlayRuntimeReleaseGatePreflightAdapter";
import {
  RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow, OverlayUiEmptyHint } from "./OverlayUiPrimitives";

const OVERLAY_PREFLIGHT_ROW_LIST_STYLE = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 11,
  color: t.textMuted,
  lineHeight: 1.45,
  overflowWrap: "anywhere" as const,
} as const;

function OverlayPreflightDetailBlock({
  title,
  rows,
  emptyHint,
}: {
  readonly title: string;
  readonly rows: readonly string[];
  readonly emptyHint: string;
}) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary }}>{title}</div>
      {rows.length > 0 ? (
        <ul style={OVERLAY_PREFLIGHT_ROW_LIST_STYLE}>
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <OverlayUiEmptyHint message={emptyHint} />
      )}
    </>
  );
}

export function OverlayRuntimeReleaseGatePreflightSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeReleaseGatePreflightSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Release-Gate Final Preflight (H35 / H35.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Preflight readiness" value={vm.preflightReadinessKo} />
        <OverlayUiKeyValueRow label="Preflight mode" value={vm.preflightModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H36 entry readiness" value={vm.h36EntryReadinessKo} />
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
            <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
          </>
        ) : null}
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top blocker / boundary / finding" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenBoundaryOperation ? (
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
            <OverlayPreflightDetailBlock
              title="Input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayPreflightDetailBlock
              title="Output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayPreflightDetailBlock
              title="Forbidden boundary operations"
              rows={vm.forbiddenBoundaryOperationRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayPreflightDetailBlock
              title="No-execution proof"
              rows={vm.noExecutionProofRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof}
            />
            <OverlayPreflightDetailBlock
              title="Operation-forbidden proof"
              rows={vm.operationForbiddenProofRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof}
            />
            <OverlayPreflightDetailBlock
              title="Boundary violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.boundaryViolation}
            />
            <OverlayPreflightDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.readinessFinding}
            />
            <OverlayPreflightDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.alignmentFinding}
            />
            <OverlayPreflightDetailBlock
              title="Final gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayPreflightDetailBlock
              title="Preflight checklist"
              rows={vm.preflightChecklistRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayPreflightDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayPreflightDetailBlock
              title="Preflight blockers"
              rows={vm.preflightBlockerRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.blocker}
            />
            <OverlayPreflightDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
