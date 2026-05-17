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
