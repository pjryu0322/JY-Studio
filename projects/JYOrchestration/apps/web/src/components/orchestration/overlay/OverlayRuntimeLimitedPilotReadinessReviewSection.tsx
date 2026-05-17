"use client";

import type { OverlayRuntimeLimitedPilotReadinessReviewSectionVM } from "@/lib/overlay-ui/overlayRuntimeLimitedPilotReadinessReviewAdapter";
import {
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeLimitedPilotReadinessReviewSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeLimitedPilotReadinessReviewSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Limited Pilot Readiness Review (H43 / H43.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Limited pilot readiness review status" value={vm.reviewStatusKo} />
        <OverlayUiKeyValueRow label="Review mode" value={vm.reviewModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate status" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H44 entry readiness" value={vm.h44EntryReadinessKo} />
        <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
        <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top violation / blocker" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenBoundaryOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden boundary operation" value={vm.topForbiddenBoundaryOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow
              label="Pilot contract hardening boundary"
              value={vm.contractHardeningBoundarySummaryKo}
            />
            <OverlayUiKeyValueRow label="Input envelope" value={vm.inputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="Output envelope" value={vm.outputEnvelopeSummaryKo} />
            <OverlayUiKeyValueRow label="No-execution proof" value={vm.noExecutionProofSummaryKo} />
            <OverlayUiKeyValueRow label="Execution-forbidden proof" value={vm.forbiddenProofSummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Contract hardening boundary"
              rows={vm.contractBoundaryRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.contractBoundary}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness input envelope"
              rows={vm.inputEnvelopeRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.inputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness output envelope"
              rows={vm.outputEnvelopeRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.outputEnvelope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot readiness violations"
              rows={vm.readinessViolationRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.violation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.verification}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.alignment}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Final safety gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot no-execution proof"
              rows={vm.noExecutionProofRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.noExecutionProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Pilot execution-forbidden proof"
              rows={vm.forbiddenProofRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.forbiddenProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Contract readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.checklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Missing checklist"
              rows={vm.missingChecklistRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.missingChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness blockers"
              rows={vm.readinessBlockerRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_LIMITED_PILOT_READINESS_REVIEW_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_LIMITED_PILOT_READINESS_REVIEW_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
