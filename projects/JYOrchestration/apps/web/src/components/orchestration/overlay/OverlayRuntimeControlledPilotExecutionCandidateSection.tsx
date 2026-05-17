"use client";

import type { OverlayRuntimeControlledPilotExecutionCandidateSectionVM } from "@/lib/overlay-ui/overlayRuntimeControlledPilotExecutionCandidateAdapter";
import {
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeControlledPilotExecutionCandidateSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeControlledPilotExecutionCandidateSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Controlled Pilot Execution Candidate (H45)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Controlled pilot execution candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Execution mode" value={vm.executionModeKo} />
        {vm.topExecutionBlocker ? (
          <OverlayUiKeyValueRow label="Top execution blocker" value={vm.topExecutionBlocker} />
        ) : null}
        {!vm.topExecutionBlocker && vm.topForbiddenExecutionOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden execution operation" value={vm.topForbiddenExecutionOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Final runtime handoff boundary" value={vm.handoffBoundarySummaryKo} />
            <OverlayUiKeyValueRow label="Candidate scope" value={vm.candidateScopeSummaryKo} />
            <OverlayUiKeyValueRow label="Controlled pilot execution policy" value={vm.executionPolicySummaryKo} />
            <OverlayUiKeyValueRow label="Input contract" value={vm.inputContractSummaryKo} />
            <OverlayUiKeyValueRow label="Output contract" value={vm.outputContractSummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Candidate scope"
              rows={vm.candidateScopeRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.candidateScope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden execution operations"
              rows={vm.forbiddenExecutionOperationRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Input contract"
              rows={vm.inputContractRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.inputContract}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Output contract"
              rows={vm.outputContractRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.outputContract}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Execution readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Execution blockers"
              rows={vm.executionBlockerRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
