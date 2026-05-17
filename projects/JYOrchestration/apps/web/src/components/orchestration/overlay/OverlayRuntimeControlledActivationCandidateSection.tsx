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
      title="Runtime Controlled Activation Candidate (H41)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Controlled activation candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Activation mode" value={vm.activationModeKo} />
        {vm.topActivationBlocker ? (
          <OverlayUiKeyValueRow label="Top activation blocker" value={vm.topActivationBlocker} />
        ) : null}
        {!vm.topActivationBlocker && vm.topForbiddenActivationOperation ? (
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
