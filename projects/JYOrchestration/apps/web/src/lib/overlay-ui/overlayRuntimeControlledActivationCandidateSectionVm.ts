/**
 * H41 / H41.5 — Overlay runtime **controlled activation candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildControlledActivationCandidateViolationRows } from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateCheckHelpers";
import {
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO,
} from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeControlledActivationCandidateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  activationModeKo: string;
  finalGateStatusKo: string;
  h42EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topActivationBlocker: string | null;
  topForbiddenActivationOperation: string | null;
  topControlledActivationViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  handoffBoundarySummaryKo: string;
  candidateScopeSummaryRows: readonly string[];
  forbiddenActivationOperationRows: readonly string[];
  activationPolicySummaryKo: string;
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  activationBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeControlledActivationCandidateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeControlledActivationCandidateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeControlledActivationCandidateSummary;
  const handoff = reports.runtimeControlHandoffBoundary;
  const scope = reports.runtimeControlledActivationCandidateScope;
  const policy = reports.runtimeControlledActivationCandidatePolicy;
  const blockers = reports.runtimeControlledActivationCandidateBlockerReport;
  const checklist = reports.runtimeControlledActivationReadinessChecklist;
  const boundaryViolation = reports.runtimeControlledActivationCandidateViolationReport;
  const readinessVerification = reports.runtimeControlledActivationCandidateVerificationReport;
  const alignment = reports.runtimeControlledActivationCandidateAlignmentReport;
  const finalGate = reports.runtimeControlledActivationCandidateFinalSafetyGate;

  const candidateScopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredCandidateInputs.slice(0, 2),
        ...scope.expectedCandidateOutputs.slice(0, 2),
      ];
  const forbiddenActivationOperationRows = sliceOverlayRows(
    scope.forbiddenCandidateOperations,
    compactAndNarrowUi
  );
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildControlledActivationCandidateViolationRows(
    boundaryViolation,
    compactAndNarrowUi
  );
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const activationBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.activationBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.activationBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topActivationBlocker =
    blockers.blockers[0] ??
    summary.activationBlockers[0] ??
    checklist.blockers[0] ??
    finalGate.blockers[0] ??
    null;
  const topForbiddenActivationOperation = scope.forbiddenCandidateOperations[0] ?? null;
  const topControlledActivationViolation =
    boundaryViolation.actualFlagViolations[0] ??
    boundaryViolation.policyViolations[0] ??
    boundaryViolation.wordingRiskFindings[0] ??
    null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topControlledActivationViolation ?? topActivationBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const handoffBoundarySummaryKo = compactAndNarrowUi
    ? handoff.boundarySourceLayer
    : [`source: ${handoff.boundarySourceLayer}`, `target: ${handoff.boundaryTargetLayer}`].join(" · ");

  const activationPolicySummaryKo = compactAndNarrowUi
    ? RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]
    : [
        `allowed: ${RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]}`,
        "operatorReviewRequired",
        "rollbackReadinessRequired",
        "auditTraceRequired",
      ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "controlled_activation_metadata_candidate" ||
      summary.activationMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.policyViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      policy.actualControlledActivationForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    activationModeKo: RUNTIME_CONTROLLED_ACTIVATION_MODE_LABEL_KO[summary.activationMode],
    finalGateStatusKo: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h42EntryReadinessKo: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.h42EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topActivationBlocker,
    topForbiddenActivationOperation,
    topControlledActivationViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    handoffBoundarySummaryKo,
    candidateScopeSummaryRows,
    forbiddenActivationOperationRows,
    activationPolicySummaryKo,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    activationBlockerRows,
    recommendationRows,
  };
}
