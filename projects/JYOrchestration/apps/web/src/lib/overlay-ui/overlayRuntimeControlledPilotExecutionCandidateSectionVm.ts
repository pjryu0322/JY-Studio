/**
 * H45 — Overlay runtime **controlled pilot execution candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO,
} from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeControlledPilotExecutionCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  executionModeKo: string;
  topExecutionBlocker: string | null;
  topForbiddenExecutionOperation: string | null;
  handoffBoundarySummaryKo: string;
  candidateScopeSummaryKo: string;
  executionPolicySummaryKo: string;
  inputContractSummaryKo: string;
  outputContractSummaryKo: string;
  candidateScopeRows: readonly string[];
  forbiddenExecutionOperationRows: readonly string[];
  inputContractRows: readonly string[];
  outputContractRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  executionBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeControlledPilotExecutionCandidateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeControlledPilotExecutionCandidateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeControlledPilotExecutionCandidateSummary;
  const handoff = reports.runtimeFinalRuntimeHandoffBoundary;
  const scope = reports.runtimeControlledPilotExecutionCandidateScope;
  const policy = reports.runtimeControlledPilotExecutionCandidatePolicy;
  const blockers = reports.runtimeControlledPilotExecutionCandidateBlockerReport;
  const checklist = reports.runtimeControlledPilotExecutionReadinessChecklist;
  const inputContract = reports.runtimeControlledPilotExecutionInputContract;
  const outputContract = reports.runtimeControlledPilotExecutionOutputContract;

  const candidateScopeRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredCandidateInputs.slice(0, 2),
      ];
  const forbiddenExecutionOperationRows = sliceOverlayRows(scope.forbiddenCandidateOperations, compactAndNarrowUi);
  const inputContractRows = sliceOverlayRows(inputContract.contractRows, compactAndNarrowUi);
  const outputContractRows = sliceOverlayRows(outputContract.contractRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const executionBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.executionBlockers,
        ...checklist.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.executionBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topExecutionBlocker =
    blockers.blockers[0] ?? summary.executionBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenExecutionOperation = scope.forbiddenCandidateOperations[0] ?? null;

  const handoffBoundarySummaryKo = compactAndNarrowUi
    ? handoff.boundarySourceLayer
    : [`source: ${handoff.boundarySourceLayer}`, `target: ${handoff.boundaryTargetLayer}`].join(" · ");

  const candidateScopeSummaryKo = compactAndNarrowUi
    ? scope.candidateSourceLayer
    : [`source: ${scope.candidateSourceLayer}`, `target: ${scope.candidateTargetLayer}`].join(" · ");

  const executionPolicySummaryKo = compactAndNarrowUi
    ? RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO[policy.executionAllowedMode]
    : [
        `allowed: ${RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO[policy.executionAllowedMode]}`,
        "operatorReviewRequired",
        "rollbackReadinessRequired",
        "auditTraceRequired",
      ].join(" · ");

  const inputContractSummaryKo = compactAndNarrowUi
    ? `${inputContract.contractRows.length} rows`
    : inputContract.contractRows.slice(0, 2).join(" · ") || "—";

  const outputContractSummaryKo = compactAndNarrowUi
    ? `${outputContract.contractRows.length} rows`
    : outputContract.contractRows.slice(0, 2).join(" · ") || "—";

  return {
    sectionDisclaimer: RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "controlled_pilot_execution_metadata_candidate" ||
      summary.executionMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      policy.actualPilotActivationForbidden !== true ||
      policy.actualPilotExecutionForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    executionModeKo: RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO[summary.executionMode],
    topExecutionBlocker,
    topForbiddenExecutionOperation,
    handoffBoundarySummaryKo,
    candidateScopeSummaryKo,
    executionPolicySummaryKo,
    inputContractSummaryKo,
    outputContractSummaryKo,
    candidateScopeRows,
    forbiddenExecutionOperationRows,
    inputContractRows,
    outputContractRows,
    readinessChecklistRows,
    missingChecklistRows,
    executionBlockerRows,
    recommendationRows,
  };
}
