/**
 * H42 — limited pilot **input contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import { readLimitedPilotBoundaryUpstreamContext } from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type { RuntimeLimitedPilotInputContract } from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotInputContract(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
): RuntimeLimitedPilotInputContract {
  const {
    activationFinalGate,
    activationSummary,
    activationVerification,
    activationAlignment,
    activationViolation,
    ultimateFinalGate,
    finalGate,
    approval,
    rollback,
    audit,
  } = readLimitedPilotBoundaryUpstreamContext(reports);

  const contractRows = mergeSortedUniqueKo([
    "runtimeControlledActivationCandidateFinalSafetyGate",
    "runtimeControlledActivationCandidateSummary",
    "runtimeControlledActivationCandidatePolicy",
    "runtimeControlledActivationCandidateVerificationReport",
    "runtimeControlledActivationCandidateAlignmentReport",
    "runtimeControlledActivationCandidateViolationReport",
    "runtimeUltimateGovernanceReviewFinalSafetyGate",
    "runtimeFinalReleaseGovernanceGateFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    `activationFinalGate:${activationFinalGate.finalGateStatus}`,
    `h42EntryReadiness:${activationFinalGate.h42EntryReadiness}`,
    `activationCandidateStatus:${activationSummary.candidateStatus}`,
    `activationMode:${activationSummary.activationMode}`,
    `activationVerification:${activationVerification.verificationStatus}`,
    `activationAlignment:${activationAlignment.alignmentStatus}`,
    `activationViolations:${activationViolation.actualFlagViolations.length + activationViolation.policyViolations.length}`,
    `ultimateFinalGate:${ultimateFinalGate.finalGateStatus}`,
    `finalReleaseGate:${finalGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
  ]);

  return {
    mode: "runtime_limited_pilot_input_contract",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    contractRows,
    recommendations: mergeSortedUniqueKo([
      "H42: limited pilot input contract — metadata 참조만(실제 pilot·execution payload 없음)",
    ]),
  };
}
