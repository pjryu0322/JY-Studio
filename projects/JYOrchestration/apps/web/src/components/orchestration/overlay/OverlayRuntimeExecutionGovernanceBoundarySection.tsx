"use client";

import type { OverlayRuntimeExecutionGovernanceBoundarySectionVM } from "@/lib/overlay-ui/overlayRuntimeExecutionGovernanceBoundaryAdapter";
import {
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeExecutionGovernanceBoundarySection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeExecutionGovernanceBoundarySectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Execution Governance Boundary (H37)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Governance boundary candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Governance mode" value={vm.governanceModeKo} />
        <OverlayUiKeyValueRow label="Hardening readiness" value={vm.hardeningReadinessKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H38 entry readiness" value={vm.h38EntryReadinessKo} />
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
            <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
          </>
        ) : null}
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top blocker / violation / finding" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenGovernanceOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden governance operation" value={vm.topForbiddenGovernanceOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Governance policy" value={vm.governancePolicySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayRuntimePlanningDetailBlock
              title="Governance scope"
              rows={vm.scopeSummaryRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.scope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden governance operations"
              rows={vm.forbiddenGovernanceOperationRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Governance violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.boundaryViolation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.readinessFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.alignmentFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Final gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Governance blockers"
              rows={vm.governanceBlockerRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
