"use client";

import type { OverlayRuntimePilotValidationReadOnlyChainSectionVM } from "@/lib/overlay-ui/overlayRuntimePilotValidationReadOnlyChainAdapter";
import {
  RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_EMPTY_HINT_KO,
  RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimePilotValidation/runtimePilotValidationLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimePilotValidationReadOnlyChainSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimePilotValidationReadOnlyChainSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Pilot Validation Phase 0 — Read-only Chain Validation"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Validation status" value={vm.validationStatusKo} />
        <OverlayUiKeyValueRow label="Final gate status" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="Pilot validation entry readiness" value={vm.pilotValidationEntryReadinessKo} />
        {vm.topBlocker ? <OverlayUiKeyValueRow label="Top blocker" value={vm.topBlocker} /> : null}
        {!vm.topBlocker && vm.topWarning ? (
          <OverlayUiKeyValueRow label="Top warning" value={vm.topWarning} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="User visible summary" value={vm.userVisibleSummaryKo} />
            <OverlayUiKeyValueRow label="Operator visible summary" value={vm.operatorVisibleSummaryKo} />
            <OverlayUiKeyValueRow label="User status (UI contract)" value={vm.userSummaryVm.statusKo} />
            <OverlayUiKeyValueRow label="User primary action" value={vm.userSummaryVm.primaryActionLabelKo} />
            <OverlayUiKeyValueRow label="User secondary action" value={vm.userSummaryVm.secondaryActionLabelKo} />
            <OverlayUiKeyValueRow
              label="User approval required"
              value={vm.userSummaryVm.isUserApprovalRequired ? "yes" : "no"}
            />
            <OverlayUiKeyValueRow
              label="Can request pilot validation"
              value={vm.userSummaryVm.canRequestPilotValidation ? "yes" : "no"}
            />
            {vm.userSummaryVm.cannotProceedReasonKo ? (
              <OverlayUiKeyValueRow label="Cannot proceed reason" value={vm.userSummaryVm.cannotProceedReasonKo} />
            ) : null}
            <OverlayUiKeyValueRow
              label="Safe Echo Adapter Contract status"
              value={vm.safeEchoContractStatusKo}
            />
            <OverlayUiKeyValueRow label="Safe Echo adapter mode" value={vm.safeEchoAdapterModeKo} />
            {vm.sandboxBoundaryTopForbiddenKo ? (
              <OverlayUiKeyValueRow
                label="Top prohibited boundary operation"
                value={vm.sandboxBoundaryTopForbiddenKo}
              />
            ) : null}
            <OverlayUiKeyValueRow
              label="Input contract summary"
              value={vm.safeEchoInputContractSummaryKo}
            />
            <OverlayUiKeyValueRow
              label="Output contract summary"
              value={vm.safeEchoOutputContractSummaryKo}
            />
            <OverlayUiKeyValueRow label="Validation Request Draft status" value={vm.requestDraftStatusKo} />
            <OverlayUiKeyValueRow
              label="Operator Approval Snapshot status"
              value={vm.operatorApprovalSnapshotStatusKo}
            />
            <OverlayUiKeyValueRow label="Audit Trace Candidate status" value={vm.auditTraceCandidateStatusKo} />
            <OverlayUiKeyValueRow
              label="Rollback Plan Candidate status"
              value={vm.rollbackPlanCandidateStatusKo}
            />
            <OverlayUiKeyValueRow
              label="Validation Request ID Candidate"
              value={vm.validationRequestIdCandidate}
            />
            <OverlayUiKeyValueRow
              label="Safe Echo Invocation Simulator status"
              value={vm.simulatorStatusKo}
            />
            <OverlayUiKeyValueRow label="Simulator mode" value={vm.simulatorModeKo} />
            {vm.simulatorTopBlocker ? (
              <OverlayUiKeyValueRow label="Simulator top blocker" value={vm.simulatorTopBlocker} />
            ) : null}
            {!vm.simulatorTopBlocker && vm.simulatorTopWarning ? (
              <OverlayUiKeyValueRow label="Simulator top warning" value={vm.simulatorTopWarning} />
            ) : null}
            {vm.simulatorBoundaryTopForbiddenKo ? (
              <OverlayUiKeyValueRow
                label="Simulator boundary top forbidden operation"
                value={vm.simulatorBoundaryTopForbiddenKo}
              />
            ) : null}
            <OverlayUiKeyValueRow label="Simulator input summary" value={vm.simulatorInputSummaryKo} />
            <OverlayUiKeyValueRow label="Simulator output summary" value={vm.simulatorOutputSummaryKo} />
            <OverlayRuntimePlanningDetailBlock
              title="Final proof summary"
              rows={vm.finalProofSummaryRows}
              emptyHint={RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_EMPTY_HINT_KO.finalProof}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Prohibited operations (user UI)"
              rows={vm.userSummaryVm.prohibitedOperationRows}
              emptyHint={RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_EMPTY_HINT_KO.recommendation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
