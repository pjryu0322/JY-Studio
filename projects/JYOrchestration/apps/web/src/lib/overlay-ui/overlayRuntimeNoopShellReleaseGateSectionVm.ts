/**
 * H34 / H34.5 — Overlay runtime **no-op shell release-gate candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_SHELL_RELEASE_GATE_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_READINESS_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeNoopShellReleaseGate/runtimeNoopShellReleaseGateLabelsKo";

export type OverlayRuntimeNoopShellReleaseGateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  releaseGateModeKo: string;
  finalGateStatusKo: string;
  h35EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReleaseGateBlocker: string | null;
  topForbiddenReleaseGateOperation: string | null;
  topBoundaryViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  releaseGatePolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenReleaseGateOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  releaseGateBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeNoopShellReleaseGateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopShellReleaseGateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopShellReleaseGateSummary;
  const scope = reports.runtimeNoopShellReleaseGateScope;
  const policy = reports.runtimeNoopShellReleaseGatePolicy;
  const blockers = reports.runtimeNoopShellReleaseGateBlockerReport;
  const checklist = reports.runtimeNoopShellReleaseGateReadinessChecklist;
  const boundary = reports.runtimeNoopShellReleaseGateBoundaryViolationReport;
  const readinessVerification = reports.runtimeNoopShellReleaseGateReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellReleaseGateAlignmentReport;
  const finalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenReleaseGateOperationRows = compactAndNarrowUi
    ? scope.forbiddenReleaseGateOperations.slice(0, 1)
    : [...scope.forbiddenReleaseGateOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const missingChecklistRows = compactAndNarrowUi
    ? checklist.missingRows.slice(0, 1)
    : [...checklist.missingRows];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const readinessFindingRows = compactAndNarrowUi
    ? readinessVerification.findings.slice(0, 1)
    : [...readinessVerification.findings];
  const alignmentFindingRows = compactAndNarrowUi ? alignment.findings.slice(0, 1) : [...alignment.findings];
  const finalGateChecklistRows = compactAndNarrowUi ? finalGate.checklist.slice(0, 1) : [...finalGate.checklist];
  const releaseGateBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.releaseGateBlockers.slice(0, 1)]
    : mergeSortedUniqueKo([...blockers.blockers, ...s.releaseGateBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...finalGate.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...finalGate.recommendations]);

  const topReleaseGateBlocker =
    blockers.blockers[0] ?? s.releaseGateBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenReleaseGateOperation = scope.forbiddenReleaseGateOperations[0] ?? null;
  const topBoundaryViolation =
    boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topReleaseGateBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const releaseGatePolicySummaryKo = [
    `allowedMode: ${RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO[policy.releaseGateAllowedMode]}`,
    policy.operatorReviewBeforeReleaseGate ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualReleaseEnforcementForbidden: true",
    "actualShellExecutionForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "release_gate_metadata_candidate" ||
      s.releaseGateMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundary.actualFlagViolations.length > 0 ||
      !policy.actualReleaseEnforcementForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    releaseGateModeKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO[s.releaseGateMode],
    finalGateStatusKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h35EntryReadinessKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.h35EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_NOOP_SHELL_RELEASE_GATE_READINESS_VERIFICATION_STATUS_LABEL_KO[
        readinessVerification.verificationStatus
      ],
    alignmentStatusKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReleaseGateBlocker,
    topForbiddenReleaseGateOperation,
    topBoundaryViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    releaseGatePolicySummaryKo,
    scopeSummaryRows,
    forbiddenReleaseGateOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    releaseGateBlockerRows,
    recommendationRows,
  };
}
