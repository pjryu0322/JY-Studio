/**
 * H45 — controlled pilot execution candidate upstream·proof 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessCheckHelpers";

export { isRuntimeFinalPilotExecutionForbiddenProofComplete, isRuntimeFinalPilotNoExecutionProofValid };

export function readControlledPilotExecutionUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
) {
  return {
    executionFinalGate: reports.runtimePilotExecutionReadinessFinalSafetyGate,
    executionSummary: reports.runtimePilotExecutionReadinessSummary,
    executionVerification: reports.runtimePilotExecutionReadinessVerificationReport,
    executionAlignment: reports.runtimePilotExecutionReadinessAlignmentReport,
    executionViolation: reports.runtimePilotExecutionReadinessViolationReport,
    executionBlockers: reports.runtimePilotExecutionReadinessBlockerReport,
    executionBoundary: reports.runtimePilotExecutionReadinessBoundary,
    noExecutionProof: reports.runtimeFinalPilotNoExecutionProof,
    forbiddenProof: reports.runtimeFinalPilotExecutionForbiddenProof,
    reviewFinalGate: reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
    pilotBoundaryFinalGate: reports.runtimeLimitedPilotBoundaryFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}
