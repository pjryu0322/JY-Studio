/**
 * H42 — limited pilot boundary upstream·검증 공통 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

export function readLimitedPilotBoundaryUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
) {
  return {
    activationFinalGate: reports.runtimeControlledActivationCandidateFinalSafetyGate,
    activationVerification: reports.runtimeControlledActivationCandidateVerificationReport,
    activationAlignment: reports.runtimeControlledActivationCandidateAlignmentReport,
    activationViolation: reports.runtimeControlledActivationCandidateViolationReport,
    activationBlockers: reports.runtimeControlledActivationCandidateBlockerReport,
    activationSummary: reports.runtimeControlledActivationCandidateSummary,
    ultimateFinalGate: reports.runtimeUltimateGovernanceReviewFinalSafetyGate,
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}
