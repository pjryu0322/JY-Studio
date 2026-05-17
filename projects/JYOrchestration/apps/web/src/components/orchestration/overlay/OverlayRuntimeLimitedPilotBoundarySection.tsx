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
      title="Runtime Limited Pilot Boundary (H42)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Limited pilot boundary candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Pilot boundary mode" value={vm.pilotBoundaryModeKo} />
        {vm.topPilotBoundaryBlocker ? (
          <OverlayUiKeyValueRow label="Top pilot boundary blocker" value={vm.topPilotBoundaryBlocker} />
        ) : null}
        {!vm.topPilotBoundaryBlocker && vm.topForbiddenPilotOperation ? (
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
