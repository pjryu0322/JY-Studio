"use client";

import type { OverlayRuntimeControlledActivationCandidateSectionVM } from "@/lib/overlay-ui/overlayRuntimeControlledActivationCandidateAdapter";
import {
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeControlledActivationCandidateSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeControlledActivationCandidateSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Controlled Activation Candidate (H41 / H41.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Controlled activation candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Activation mode" value={vm.activationModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate status" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H42 entry readiness" value={vm.h42EntryReadinessKo} />
        <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top violation / blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenActivationOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden activation operation" value={vm.topForbiddenActivationOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Control handoff boundary" value={vm.handoffBoundarySummaryKo} />
            <OverlayUiKeyValueRow label="Activation policy" value={vm.activationPolicySummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Candidate scope"
              rows={vm.candidateScopeSummaryRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.candidateScope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden activation operations"
              rows={vm.forbiddenActivationOperationRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Controlled activation violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.violation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification findings"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.verification}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment findings"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.alignment}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Activation readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Final safety gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Activation blockers"
              rows={vm.activationBlockerRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
