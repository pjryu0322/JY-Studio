/**
 * H40 — orchestration readiness **input envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import { readUltimateGovernanceUpstreamContext } from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type { RuntimeOrchestrationReadinessInputEnvelope } from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeOrchestrationReadinessInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview
): RuntimeOrchestrationReadinessInputEnvelope {
  const upstream = readUltimateGovernanceUpstreamContext(reports);
  const {
    finalGate,
    finalSummary,
    finalVerification,
    finalAlignment,
    finalViolation,
    releaseFinalGate,
    governanceFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = upstream;
  const finalPolicy = reports.runtimeFinalReleaseGovernanceGatePolicy;

  const envelopeRows = mergeSortedUniqueKo([
    "runtimeFinalReleaseGovernanceGateFinalSafetyGate",
    "runtimeFinalReleaseGovernanceGateSummary",
    "runtimeFinalReleaseGovernanceGatePolicy",
    "runtimeFinalReleaseGovernanceGateVerificationReport",
    "runtimeFinalReleaseGovernanceGateAlignmentReport",
    "runtimeFinalReleaseGovernanceGateViolationReport",
    `runtimeFinalReleaseGovernanceGateFinalSafetyGate:${finalGate.finalGateStatus}`,
    `runtimeFinalReleaseGovernanceGateVerificationReport:${finalVerification.verificationStatus}`,
    `runtimeFinalReleaseGovernanceGateAlignmentReport:${finalAlignment.alignmentStatus}`,
    `runtimeFinalReleaseGovernanceGateViolationReport:${finalViolation.actualFlagViolations.length}`,
    "runtimeGovernanceReleaseReadinessFinalSafetyGate",
    "runtimeExecutionGovernanceBoundaryFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    "runtimeControlBoundarySummary",
    `finalGateStatus:${finalGate.finalGateStatus}`,
    `h40EntryReadiness:${finalGate.h40EntryReadiness}`,
    `finalGateCandidateStatus:${finalSummary.candidateStatus}`,
    `finalGateMode:${finalSummary.gateMode}`,
    `finalGateVerification:${finalVerification.verificationStatus}`,
    `finalGateAlignment:${finalAlignment.alignmentStatus}`,
    `finalGateViolations:${finalViolation.actualFlagViolations.length}`,
    `releaseFinalGateStatus:${releaseFinalGate.finalGateStatus}`,
    `governanceFinalGateStatus:${governanceFinalGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    `gateAllowedMode:${finalPolicy.gateAllowedMode}`,
  ]);

  return {
    mode: "runtime_orchestration_readiness_input_envelope",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H40: orchestration readiness input envelope — metadata only(실제 orchestration payload 없음)",
    ]),
  };
}
