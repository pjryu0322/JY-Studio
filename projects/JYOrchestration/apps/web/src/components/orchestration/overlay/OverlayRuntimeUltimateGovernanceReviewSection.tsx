"use client";

import type { OverlayRuntimeUltimateGovernanceReviewSectionVM } from "@/lib/overlay-ui/overlayRuntimeUltimateGovernanceReviewAdapter";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeUltimateGovernanceReviewSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeUltimateGovernanceReviewSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Ultimate Governance Review (H40)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Ultimate governance review status" value={vm.reviewStatusKo} />
        <OverlayUiKeyValueRow label="Review mode" value={vm.reviewModeKo} />
        {vm.topReviewBlocker ? (
          <OverlayUiKeyValueRow label="Top review blocker" value={vm.topReviewBlocker} />
        ) : null}
        {!vm.topReviewBlocker && vm.topForbiddenBoundaryOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden operation" value={vm.topForbiddenBoundaryOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow
            label="Final orchestration readiness boundary"
            value={vm.boundarySummaryKo}
          />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayRuntimePlanningDetailBlock
              title="Input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden boundary operations"
              rows={vm.forbiddenBoundaryOperationRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Ultimate no-enforcement proof"
              rows={vm.noEnforcementProofRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.noEnforcementProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Orchestration-forbidden proof"
              rows={vm.forbiddenProofRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.forbiddenProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final orchestration readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Ultimate governance blockers"
              rows={vm.reviewBlockerRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
