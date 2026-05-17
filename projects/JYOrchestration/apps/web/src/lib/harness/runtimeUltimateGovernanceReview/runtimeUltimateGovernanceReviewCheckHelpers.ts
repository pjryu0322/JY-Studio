/**
 * H40 — ultimate governance review status·blocker·proof 검증 공통 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeOrchestrationForbiddenProof, RuntimeUltimateNoEnforcementProof } from "./runtimeUltimateGovernanceReviewTypes";
import type { RuntimeUltimateGovernanceReviewStatus } from "./runtimeUltimateGovernanceReviewTypes";

export const RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS = [
  "actualOrchestrationForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
  "actualShellExecutionForbidden",
  "actualAdapterInvocationForbidden",
  "actualProviderRoutingForbidden",
  "actualQueueControlForbidden",
  "actualRollbackForbidden",
  "actualExecutionBlockingForbidden",
  "actualMergeBlockingForbidden",
  "actualPromptMutationForbidden",
  "actualTokenEnforcementForbidden",
  "actualContextPruningForbidden",
  "actualRetrievalOrchestrationForbidden",
] as const satisfies readonly (keyof RuntimeOrchestrationForbiddenProof)[];

export function readUltimateGovernanceUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview
) {
  return {
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    finalVerification: reports.runtimeFinalReleaseGovernanceGateVerificationReport,
    finalAlignment: reports.runtimeFinalReleaseGovernanceGateAlignmentReport,
    finalViolation: reports.runtimeFinalReleaseGovernanceGateViolationReport,
    finalSummary: reports.runtimeFinalReleaseGovernanceGateSummary,
    finalBlockers: reports.runtimeFinalReleaseGovernanceGateBlockerReport,
    releaseFinalGate: reports.runtimeGovernanceReleaseReadinessFinalSafetyGate,
    governanceFinalGate: reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}

export function isRuntimeUltimateNoEnforcementProofValid(
  proof: RuntimeUltimateNoEnforcementProof
): boolean {
  return proof.diagnosticOnly === true;
}

export function isRuntimeOrchestrationForbiddenProofComplete(
  proof: RuntimeOrchestrationForbiddenProof
): boolean {
  return RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS.every((key) => proof[key] === true);
}

export function resolveRuntimeUltimateGovernanceReviewStatus(input: {
  readonly upstream: ReturnType<typeof readUltimateGovernanceUpstreamContext>;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
  readonly ultimateBlockerCount: number;
}): RuntimeUltimateGovernanceReviewStatus {
  const { upstream, noEnforcementProof, forbiddenProof, ultimateBlockerCount } = input;
  const { finalGate, finalVerification, finalAlignment, finalViolation, finalSummary } = upstream;

  const proofValid =
    isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof) &&
    isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof);

  const finalGateHardBlocked =
    finalGate.finalGateStatus === "blocked" ||
    finalGate.h40EntryReadiness === "blocked" ||
    finalVerification.verificationStatus === "failed" ||
    finalAlignment.alignmentStatus === "failed" ||
    finalViolation.actualFlagViolations.length > 0 ||
    !proofValid;

  const finalGateWatch =
    finalGate.finalGateStatus === "watch" ||
    finalGate.h40EntryReadiness === "watch" ||
    finalVerification.verificationStatus === "partial" ||
    finalAlignment.alignmentStatus === "partial" ||
    finalViolation.wordingRiskFindings.length > 0;

  const finalGateBlockersBlock = finalSummary.gateBlockers.length > 0 && !finalGateWatch;

  if (finalGateHardBlocked || finalGateBlockersBlock) {
    return "blocked";
  }
  if (finalGateWatch) {
    return "watch";
  }
  if (
    finalGate.finalGateStatus === "ready_metadata" &&
    finalGate.h40EntryReadiness === "ready_metadata" &&
    finalVerification.verificationStatus === "verified_metadata" &&
    finalAlignment.alignmentStatus === "aligned_metadata" &&
    finalViolation.actualFlagViolations.length === 0 &&
    finalViolation.wordingRiskFindings.length === 0 &&
    ultimateBlockerCount === 0 &&
    finalSummary.gateBlockers.length === 0 &&
    proofValid
  ) {
    return "ultimate_governance_metadata_ready";
  }
  return "not_ready";
}
