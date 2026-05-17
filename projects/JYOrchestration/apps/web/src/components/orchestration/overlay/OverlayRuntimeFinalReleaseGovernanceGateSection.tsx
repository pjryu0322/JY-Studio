"use client";

import type { OverlayRuntimeFinalReleaseGovernanceGateSectionVM } from "@/lib/overlay-ui/overlayRuntimeFinalReleaseGovernanceGateAdapter";
import {
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeFinalReleaseGovernanceGateSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeFinalReleaseGovernanceGateSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Final Release Governance Gate (H39 / H39.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Final release governance gate candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Gate mode" value={vm.gateModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H40 entry readiness" value={vm.h40EntryReadinessKo} />
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
            <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
          </>
        ) : null}
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top blocker / violation / finding" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenGateOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden gate operation" value={vm.topForbiddenGateOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Gate policy" value={vm.gatePolicySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayRuntimePlanningDetailBlock
              title="Gate scope"
              rows={vm.gateScopeSummaryRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.scope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden gate operations"
              rows={vm.forbiddenGateOperationRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final gate violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.boundaryViolation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.readinessFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.alignmentFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Final gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Gate blockers"
              rows={vm.gateBlockerRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_OVERLAY_FOOTER_KO}
        </div>
        </div>
    </OverlayUiSection>
  );
}
