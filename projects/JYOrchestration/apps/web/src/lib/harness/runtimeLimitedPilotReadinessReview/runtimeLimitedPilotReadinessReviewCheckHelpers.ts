/**
 * H43 — limited pilot readiness review upstream·proof 검증 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readLimitedPilotBoundaryUpstreamContext } from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryCheckHelpers";
import { RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS } from "./runtimeLimitedPilotReadinessReviewConstants";
import type { RuntimePilotExecutionForbiddenProof } from "./runtimeLimitedPilotReadinessReviewTypes";

export function readLimitedPilotReadinessUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
) {
  return {
    ...readLimitedPilotBoundaryUpstreamContext(reports),
    pilotBoundaryFinalGate: reports.runtimeLimitedPilotBoundaryFinalSafetyGate,
    pilotBoundarySummary: reports.runtimeLimitedPilotBoundarySummary,
    pilotBoundaryPolicy: reports.runtimeLimitedPilotBoundaryPolicy,
    pilotBoundaryVerification: reports.runtimeLimitedPilotBoundaryVerificationReport,
    pilotBoundaryAlignment: reports.runtimeLimitedPilotBoundaryAlignmentReport,
    pilotBoundaryViolation: reports.runtimeLimitedPilotBoundaryViolationReport,
    pilotBoundaryBlockers: reports.runtimeLimitedPilotBoundaryBlockerReport,
    pilotInputContract: reports.runtimeLimitedPilotInputContract,
    pilotOutputContract: reports.runtimeLimitedPilotOutputContract,
  };
}

export function isRuntimePilotExecutionForbiddenProofComplete(
  proof: RuntimePilotExecutionForbiddenProof
): boolean {
  return RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS.every(
    (key) => proof[key] === true
  );
}

export function isRuntimePilotNoExecutionProofValid(
  proof: Readonly<{ diagnosticOnly: boolean }>
): boolean {
  return proof.diagnosticOnly === true;
}
