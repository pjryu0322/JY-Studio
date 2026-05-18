"use client";

import type { OverlayRuntimeExecutionBoundaryShellSectionVM } from "@/lib/overlay-ui/overlayRuntimeExecutionBoundaryShellAdapter";
import {
  RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_OVERLAY_FOOTER_KO,
} from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellLabelsKo";
import { uiTokens as t } from "@/components/ui/tokens";
import { OverlayUiSection, OverlayUiKeyValueRow } from "./OverlayUiPrimitives";
import { OverlayRuntimePlanningDetailBlock } from "./OverlayRuntimePlanningDetailBlock";

export function OverlayRuntimeExecutionBoundaryShellSection({
  vm,
  defaultOpen,
}: {
  readonly vm: OverlayRuntimeExecutionBoundaryShellSectionVM;
  readonly defaultOpen?: boolean;
}) {
  return (
    <OverlayUiSection
      title="Runtime Execution Boundary Metadata Shell (H36 / H36.5)"
      description={vm.sectionDisclaimer}
      defaultOpen={defaultOpen}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" as const }}>
        <OverlayUiKeyValueRow label="Boundary shell candidate status" value={vm.candidateStatusKo} />
        <OverlayUiKeyValueRow label="Shell mode" value={vm.shellModeKo} />
        <OverlayUiKeyValueRow label="Final safety gate" value={vm.finalGateStatusKo} />
        <OverlayUiKeyValueRow label="H37 entry readiness" value={vm.h37EntryReadinessKo} />
        {vm.showDetailSections ? (
          <>
            <OverlayUiKeyValueRow label="Readiness verification" value={vm.readinessVerificationStatusKo} />
            <OverlayUiKeyValueRow label="Alignment report" value={vm.alignmentStatusKo} />
          </>
        ) : null}
        {vm.topViolationOrBlocker ? (
          <OverlayUiKeyValueRow label="Top blocker / boundary / finding" value={vm.topViolationOrBlocker} />
        ) : null}
        {!vm.topViolationOrBlocker && vm.topForbiddenShellOperation ? (
          <OverlayUiKeyValueRow label="Top forbidden shell operation" value={vm.topForbiddenShellOperation} />
        ) : null}
        {vm.showDetailSections ? (
          <OverlayUiKeyValueRow label="Shell policy" value={vm.shellPolicySummaryKo} />
        ) : null}
        {vm.showDetailSections ? (
          <>
            <OverlayRuntimePlanningDetailBlock
              title="Shell scope"
              rows={vm.scopeSummaryRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.scope}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Forbidden shell operations"
              rows={vm.forbiddenShellOperationRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.forbiddenOperation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Boundary violations"
              rows={vm.boundaryViolationRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.boundaryViolation}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness verification"
              rows={vm.readinessFindingRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.readinessFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Alignment report"
              rows={vm.alignmentFindingRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.alignmentFinding}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Readiness checklist"
              rows={vm.readinessChecklistRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.checklist}
            />
            {vm.missingChecklistRows.length > 0 ? (
              <OverlayRuntimePlanningDetailBlock
                title="Missing checklist"
                rows={vm.missingChecklistRows}
                emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.missingChecklist}
              />
            ) : null}
            <OverlayRuntimePlanningDetailBlock
              title="Final gate checklist"
              rows={vm.finalGateChecklistRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.finalGateChecklist}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Shell blockers"
              rows={vm.shellBlockerRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.blocker}
            />
            <OverlayRuntimePlanningDetailBlock
              title="Recommendations"
              rows={vm.recommendationRows}
              emptyHint={RUNTIME_EXECUTION_BOUNDARY_SHELL_EMPTY_HINT_KO.recommendation}
            />
          </>
        ) : null}
        <div style={{ fontSize: 10, color: t.textMuted, lineHeight: 1.4 }}>
          {RUNTIME_EXECUTION_BOUNDARY_SHELL_OVERLAY_FOOTER_KO}
        </div>
      </div>
    </OverlayUiSection>
  );
}
