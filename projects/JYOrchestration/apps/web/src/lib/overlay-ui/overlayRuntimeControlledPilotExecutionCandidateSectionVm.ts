/**
 * H45 / H45.5 — Overlay runtime **controlled pilot execution candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildControlledPilotExecutionCandidateViolationRows } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateCheckHelpers";
import {
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_SECTION_DISCLAIMER_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO,
} from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeControlledPilotExecutionCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  executionModeKo: string;
  finalGateStatusKo: string;
  pilotValidationEntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topExecutionBlocker: string | null;
  topForbiddenExecutionOperation: string | null;
  topControlledPilotExecutionViolation: string | null;
  topVerificationFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  handoffBoundarySummaryKo: string;
  candidateScopeSummaryKo: string;
  executionPolicySummaryKo: string;
  inputContractSummaryKo: string;
  outputContractSummaryKo: string;
  candidateScopeRows: readonly string[];
  forbiddenExecutionOperationRows: readonly string[];
  inputContractRows: readonly string[];
  outputContractRows: readonly string[];
  controlledPilotExecutionViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
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
  const boundaryViolation = reports.runtimeControlledPilotExecutionCandidateViolationReport;
  const readinessVerification = reports.runtimeControlledPilotExecutionCandidateVerificationReport;
  const alignment = reports.runtimeControlledPilotExecutionCandidateAlignmentReport;
  const finalGate = reports.runtimeControlledPilotExecutionCandidateFinalSafetyGate;

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
  const controlledPilotExecutionViolationRows = buildControlledPilotExecutionCandidateViolationRows(
    boundaryViolation,
    compactAndNarrowUi
  );
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const executionBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.executionBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.executionBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topExecutionBlocker =
    blockers.blockers[0] ??
    summary.executionBlockers[0] ??
    checklist.blockers[0] ??
    finalGate.blockers[0] ??
    null;
  const topForbiddenExecutionOperation = scope.forbiddenCandidateOperations[0] ?? null;
  const topControlledPilotExecutionViolation =
    boundaryViolation.actualFlagViolations[0] ??
    boundaryViolation.policyViolations[0] ??
    boundaryViolation.wordingRiskFindings[0] ??
    null;
  const topVerificationFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topControlledPilotExecutionViolation ??
    topExecutionBlocker ??
    topVerificationFinding ??
    topAlignmentFinding ??
    null;

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
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.policyViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      policy.actualPilotActivationForbidden !== true ||
      policy.actualPilotExecutionForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    executionModeKo: RUNTIME_CONTROLLED_PILOT_EXECUTION_MODE_LABEL_KO[summary.executionMode],
    finalGateStatusKo:
      RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    pilotValidationEntryReadinessKo:
      RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.pilotValidationEntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_VERIFICATION_STATUS_LABEL_KO[
        readinessVerification.verificationStatus
      ],
    alignmentStatusKo: RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topExecutionBlocker,
    topForbiddenExecutionOperation,
    topControlledPilotExecutionViolation,
    topVerificationFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    handoffBoundarySummaryKo,
    candidateScopeSummaryKo,
    executionPolicySummaryKo,
    inputContractSummaryKo,
    outputContractSummaryKo,
    candidateScopeRows,
    forbiddenExecutionOperationRows,
    inputContractRows,
    outputContractRows,
    controlledPilotExecutionViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    readinessChecklistRows,
    missingChecklistRows,
    executionBlockerRows,
    recommendationRows,
  };
}
