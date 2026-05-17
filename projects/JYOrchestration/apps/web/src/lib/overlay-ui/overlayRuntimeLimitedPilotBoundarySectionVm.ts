/**
 * H42 — Overlay runtime **limited pilot boundary** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_LIMITED_PILOT_BOUNDARY_MODE_LABEL_KO,
  RUNTIME_LIMITED_PILOT_BOUNDARY_SECTION_DISCLAIMER_KO,
  RUNTIME_LIMITED_PILOT_BOUNDARY_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeLimitedPilotBoundarySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  pilotBoundaryModeKo: string;
  topPilotBoundaryBlocker: string | null;
  topForbiddenPilotOperation: string | null;
  pilotBoundaryScopeSummaryKo: string;
  pilotBoundaryScopeSummaryRows: readonly string[];
  forbiddenPilotOperationRows: readonly string[];
  pilotBoundaryPolicySummaryKo: string;
  inputContractSummaryKo: string;
  outputContractSummaryKo: string;
  inputContractRows: readonly string[];
  outputContractRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  pilotBoundaryBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeLimitedPilotBoundarySectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeLimitedPilotBoundarySectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeLimitedPilotBoundarySummary;
  const scope = reports.runtimeLimitedPilotBoundaryScope;
  const policy = reports.runtimeLimitedPilotBoundaryPolicy;
  const inputContract = reports.runtimeLimitedPilotInputContract;
  const outputContract = reports.runtimeLimitedPilotOutputContract;
  const blockers = reports.runtimeLimitedPilotBoundaryBlockerReport;
  const checklist = reports.runtimeLimitedPilotReadinessChecklist;

  const pilotBoundaryScopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredPilotBoundaryInputs.slice(0, 2),
      ];
  const forbiddenPilotOperationRows = sliceOverlayRows(scope.forbiddenPilotBoundaryOperations, compactAndNarrowUi);
  const inputContractRows = sliceOverlayRows(inputContract.contractRows, compactAndNarrowUi);
  const outputContractRows = sliceOverlayRows(outputContract.contractRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const pilotBoundaryBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.pilotBoundaryBlockers,
        ...checklist.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.pilotBoundaryBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topPilotBoundaryBlocker =
    blockers.blockers[0] ?? summary.pilotBoundaryBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenPilotOperation = scope.forbiddenPilotBoundaryOperations[0] ?? null;

  const pilotBoundaryScopeSummaryKo = compactAndNarrowUi
    ? scope.candidateSourceLayer
    : [`source: ${scope.candidateSourceLayer}`, `target: ${scope.candidateTargetLayer}`].join(" · ");

  const pilotBoundaryPolicySummaryKo = compactAndNarrowUi
    ? RUNTIME_LIMITED_PILOT_BOUNDARY_MODE_LABEL_KO[policy.pilotBoundaryAllowedMode]
    : [
        `allowed: ${RUNTIME_LIMITED_PILOT_BOUNDARY_MODE_LABEL_KO[policy.pilotBoundaryAllowedMode]}`,
        "operatorReviewRequired",
        "rollbackReadinessRequired",
        "auditTraceRequired",
      ].join(" · ");

  const inputContractSummaryKo = compactAndNarrowUi
    ? String(inputContract.contractRows.length)
    : `${inputContract.contractRows.length} input metadata rows`;
  const outputContractSummaryKo = compactAndNarrowUi
    ? String(outputContract.contractRows.length)
    : `${outputContract.contractRows.length} output metadata rows`;

  return {
    sectionDisclaimer: RUNTIME_LIMITED_PILOT_BOUNDARY_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "limited_pilot_boundary_metadata_candidate" ||
      summary.pilotBoundaryMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      policy.actualPilotActivationForbidden !== true ||
      policy.actualSandboxInvocationForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_LIMITED_PILOT_BOUNDARY_STATUS_LABEL_KO[summary.candidateStatus],
    pilotBoundaryModeKo: RUNTIME_LIMITED_PILOT_BOUNDARY_MODE_LABEL_KO[summary.pilotBoundaryMode],
    topPilotBoundaryBlocker,
    topForbiddenPilotOperation,
    pilotBoundaryScopeSummaryKo,
    pilotBoundaryScopeSummaryRows,
    forbiddenPilotOperationRows,
    pilotBoundaryPolicySummaryKo,
    inputContractSummaryKo,
    outputContractSummaryKo,
    inputContractRows,
    outputContractRows,
    readinessChecklistRows,
    missingChecklistRows,
    pilotBoundaryBlockerRows,
    recommendationRows,
  };
}
