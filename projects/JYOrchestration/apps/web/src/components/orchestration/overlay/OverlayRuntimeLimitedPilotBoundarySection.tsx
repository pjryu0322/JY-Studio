"use client";

import type { OverlayRuntimeLimitedPilotBoundarySectionVM } from "@/lib/overlay-ui/overlayRuntimeLimitedPilotBoundaryAdapter";
import {
  RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO,
  RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeLimitedPilotBoundarySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeLimitedPilotBoundarySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Limited Pilot Boundary (H42 / H42.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Limited pilot boundary candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Pilot boundary mode" value={vm.pilotBoundaryModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate status" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H43 entry readiness" value={vm.h43EntryReadinessKo} />
        <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top violation / blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenPilotOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden pilot operation" value={vm.topForbiddenPilotOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Pilot boundary scope" value={vm.pilotBoundaryScopeSummaryKo} />
            <OverlayUiKeyValueRow label="Pilot boundary policy" value={vm.pilotBoundaryPolicySummaryKo} />
            <OverlayUiKeyValueRow label="Input contract" value={vm.inputContractSummaryKo} />
            <OverlayUiKeyValueRow label="Output contract" value={vm.outputContractSummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Candidate scope"
              rows={vm.pilotBoundaryScopeSummaryRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.pilotScope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden pilot operations"
              rows={vm.forbiddenPilotOperationRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Limited pilot boundary violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.violation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification findings"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.verification}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment findings"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.alignment}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Input contract rows"
              rows={vm.inputContractRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.inputContract}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Output contract rows"
              rows={vm.outputContractRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.outputContract}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Final safety gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot boundary blockers"
              rows={vm.pilotBoundaryBlockerRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
