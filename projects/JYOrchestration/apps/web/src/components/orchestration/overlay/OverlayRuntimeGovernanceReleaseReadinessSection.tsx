"use client";

import type { OverlayRuntimeGovernanceReleaseReadinessSectionVM } from "@/lib/overlay-ui/overlayRuntimeGovernanceReleaseReadinessAdapter";
import {
  RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeGovernanceReleaseReadinessSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeGovernanceReleaseReadinessSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Governance Release-Readiness (H38)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Release readiness" value={vm.readinessStatusKo} />
        <OverlayUiKeyValueRow label="Readiness mode" value={vm.readinessModeKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top blocker / forbidden operation" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenBoundaryOperation ? (
          <OverlayUiKeyValueRow
            label="Top forbidden boundary operation"
            value={vm.topForbiddenBoundaryOperation}
          />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Final execution governance readiness boundary" value={vm.boundarySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayRuntimePlanningDetailBlock
              title="Input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden boundary operations"
              rows={vm.forbiddenBoundaryOperationRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="No-enforcement proof"
              rows={vm.noEnforcementProofRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.noEnforcementProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Execution-governance-forbidden proof"
              rows={vm.forbiddenProofRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.forbiddenProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Release blockers"
              rows={vm.releaseBlockerRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_GOVERNANCE_RELEASE_READINESS_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_GOVERNANCE_RELEASE_READINESS_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
