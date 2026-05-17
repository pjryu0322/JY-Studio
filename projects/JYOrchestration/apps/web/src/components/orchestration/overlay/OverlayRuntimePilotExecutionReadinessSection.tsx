"use client";

import type { OverlayRuntimePilotExecutionReadinessSectionVM } from "@/lib/overlay-ui/overlayRuntimePilotExecutionReadinessAdapter";
import {
  RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessLabelsKo";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimePilotExecutionReadinessSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePilotExecutionReadinessSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Pilot Execution Readiness (H44)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Pilot execution readiness status" value={vm.readinessStatusKo} />
        <OverlayUiKeyValueRow label="Readiness mode" value={vm.readinessModeKo} />
        {vm.topReadinessBlocker ? (
          <OverlayUiKeyValueRow label="Top readiness blocker" value={vm.topReadinessBlocker} />
        ) : null}
        {!vm.topReadinessBlocker && vm.topForbiddenBoundaryOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden boundary operation" value={vm.topForbiddenBoundaryOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow
              label="Pilot execution readiness boundary"
              value={vm.executionReadinessBoundarySummaryKo}
            />
            <OverlayUiKeyValueRow label="Input envelope" value={vm.inputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="Output envelope" value={vm.outputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="Final no-execution proof" value={vm.finalNoExecutionProofSummaryKo} />
            <OverlayUiKeyValueRow label="Final execution-forbidden proof" value={vm.finalForbiddenProofSummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Execution readiness boundary"
              rows={vm.boundaryRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.boundary}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Execution readiness input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Execution readiness output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final pilot no-execution proof"
              rows={vm.finalNoExecutionProofRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.noExecutionProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final pilot execution-forbidden proof"
              rows={vm.finalForbiddenProofRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.forbiddenProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot execution readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.checklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Missing checklist rows"
              rows={vm.missingChecklistRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.checklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness blockers"
              rows={vm.readinessBlockerRows}
              emptyHint={RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO.blockers}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint="recommendation 없음"
            />
          </>
        ) : null}
        <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO}</p>
      </div>
    </OverlayUiSection>
  );
}
