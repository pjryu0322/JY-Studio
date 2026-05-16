/**
 * H27 / H27.5 — Overlay runtime **pilot activation candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_PILOT_ACTIVATION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_PILOT_ACTIVATION_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO,
  RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO,
  runtimePilotActivationReadinessVerificationStatusKo,
} from "@/lib/harness/runtimePilotActivation/runtimePilotActivationLabelsKo";

export type OverlayRuntimePilotActivationSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  activationModeKo: string;
  finalGateStatusKo: string;
  h28EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  topActivationBlocker: string | null;
  topBoundaryViolation: string | null;
  topViolationOrBlocker: string | null;
  topForbiddenActivationOperation: string | null;
  topReadinessFinding: string | null;
  activationPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenActivationOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  activationBlockerRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimePilotActivationSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotActivationSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimePilotActivationSummary;
  const scope = reports.runtimePilotActivationScope;
  const policy = reports.runtimePilotActivationPolicy;
  const blockers = reports.runtimePilotActivationBlockerReport;
  const checklist = reports.runtimePilotActivationReadinessChecklist;
  const gate = reports.runtimePilotActivationFinalSafetyGate;
  const boundary = reports.runtimePilotActivationBoundaryViolationReport;
  const verification = reports.runtimePilotActivationReadinessVerificationReport;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenActivationOperationRows = compactAndNarrowUi
    ? scope.forbiddenActivationOperations.slice(0, 1)
    : [...scope.forbiddenActivationOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const activationBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.activationBlockers.slice(0, 1)]
    : mergeSortedUniqueKo([...blockers.blockers, ...s.activationBlockers]);
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const readinessFindingRows = compactAndNarrowUi
    ? verification.findings.slice(0, 1)
    : [...verification.findings];
  const finalGateChecklistRows = compactAndNarrowUi ? gate.checklist.slice(0, 1) : [...gate.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]);

  const topBoundaryViolation =
    boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topActivationBlocker = blockers.blockers[0] ?? s.activationBlockers[0] ?? gate.blockers[0] ?? null;
  const topReadinessFinding = verification.findings[0] ?? null;
  const topViolationOrBlocker = topBoundaryViolation ?? topActivationBlocker ?? topReadinessFinding;
  const topForbiddenActivationOperation = scope.forbiddenActivationOperations[0] ?? null;

  const activationPolicySummaryKo = [
    `allowedMode: ${RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO[policy.activationAllowedMode]}`,
    policy.operatorReviewBeforeActivation ? "operatorReview: required" : "operatorReview: optional",
    policy.sandboxPreflightRequired ? "sandboxPreflight: required" : "sandboxPreflight: optional",
    "actualActivationForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "activation_metadata_candidate" ||
      gate.finalGateStatus !== "ready_metadata" ||
      s.activationMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.blockers.length > 0 ||
      boundary.actualFlagViolations.length > 0 ||
      verification.verificationStatus !== "verified_metadata",
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_PILOT_ACTIVATION_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    activationModeKo: RUNTIME_PILOT_ACTIVATION_MODE_LABEL_KO[s.activationMode],
    finalGateStatusKo: RUNTIME_PILOT_ACTIVATION_FINAL_GATE_STATUS_LABEL_KO[gate.finalGateStatus],
    h28EntryReadinessKo: RUNTIME_PILOT_ACTIVATION_FINAL_GATE_STATUS_LABEL_KO[gate.h28EntryReadiness],
    readinessVerificationStatusKo: runtimePilotActivationReadinessVerificationStatusKo(
      verification.verificationStatus
    ),
    topActivationBlocker,
    topBoundaryViolation,
    topViolationOrBlocker,
    topForbiddenActivationOperation,
    topReadinessFinding,
    activationPolicySummaryKo,
    scopeSummaryRows,
    forbiddenActivationOperationRows,
    readinessChecklistRows,
    activationBlockerRows,
    boundaryViolationRows,
    readinessFindingRows,
    finalGateChecklistRows,
    recommendationRows,
  };
}
