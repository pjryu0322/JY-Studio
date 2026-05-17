/**
 * H41 — controlled activation candidate upstream·checklist 공통 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

export function readControlledActivationUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
) {
  return {
    ultimateFinalGate: reports.runtimeUltimateGovernanceReviewFinalSafetyGate,
    ultimateVerification: reports.runtimeUltimateGovernanceReviewVerificationReport,
    ultimateAlignment: reports.runtimeUltimateGovernanceReviewAlignmentReport,
    ultimateViolation: reports.runtimeUltimateGovernanceReviewViolationReport,
    ultimateBlockers: reports.runtimeUltimateGovernanceBlockerReport,
    ultimateSummary: reports.runtimeUltimateGovernanceReviewSummary,
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    releaseFinalGate: reports.runtimeGovernanceReleaseReadinessFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
    noEnforcementProof: reports.runtimeUltimateNoEnforcementProof,
    forbiddenProof: reports.runtimeOrchestrationForbiddenProof,
  };
}
