"use client";

import type { OverlayRuntimeReleaseGatePreflightSectionVM } from "@/lib/overlay-ui/overlayRuntimeReleaseGatePreflightAdapter";
import {
  RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

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
            <OverlayRuntimePlanningDetailBlock
              title="Input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden boundary operations"
              rows={vm.forbiddenBoundaryOperationRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="No-execution proof"
              rows={vm.noExecutionProofRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Operation-forbidden proof"
              rows={vm.operationForbiddenProofRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.proof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Boundary violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.boundaryViolation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.readinessFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.alignmentFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Preflight checklist"
              rows={vm.preflightChecklistRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Preflight blockers"
              rows={vm.preflightBlockerRows}
              emptyHint={RUNTIME_RELEASE_GATE_PREFLIGHT_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
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
