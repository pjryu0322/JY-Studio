/**
 * H45 — controlled pilot execution **input contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";
import { readControlledPilotExecutionUpstreamContext } from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type { RuntimeControlledPilotExecutionInputContract } from "./runtimeControlledPilotExecutionCandidateTypes";

export function buildRuntimeControlledPilotExecutionInputContract(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): RuntimeControlledPilotExecutionInputContract {
  const {
    executionFinalGate,
    executionSummary,
    executionVerification,
    executionAlignment,
    executionViolation,
    reviewFinalGate,
    pilotBoundaryFinalGate,
    approval,
    rollback,
    audit,
  } = readControlledPilotExecutionUpstreamContext(reports);

  const contractRows = mergeSortedUniqueKo([
    "runtimePilotExecutionReadinessFinalSafetyGate",
    "runtimePilotExecutionReadinessSummary",
    "runtimePilotExecutionReadinessVerificationReport",
    "runtimePilotExecutionReadinessAlignmentReport",
    "runtimePilotExecutionReadinessViolationReport",
    "runtimePilotExecutionReadinessBoundary",
    "runtimeFinalPilotNoExecutionProof",
    "runtimeFinalPilotExecutionForbiddenProof",
    "runtimeLimitedPilotReadinessReviewFinalSafetyGate",
    "runtimeLimitedPilotBoundaryFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    `executionFinalGate:${executionFinalGate.finalGateStatus}`,
    `h45EntryReadiness:${executionFinalGate.h45EntryReadiness}`,
    `readinessStatus:${executionSummary.readinessStatus}`,
    `readinessVerification:${executionVerification.verificationStatus}`,
    `readinessAlignment:${executionAlignment.alignmentStatus}`,
    `executionViolations:${executionViolation.actualFlagViolations.length + executionViolation.proofViolations.length + executionViolation.forbiddenProofViolations.length}`,
    `reviewFinalGate:${reviewFinalGate.finalGateStatus}`,
    `pilotBoundaryFinalGate:${pilotBoundaryFinalGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    "pilotExecutionPayloadGeneration:forbidden",
    "adapterInvocationPayloadGeneration:forbidden",
    "sandboxInvocationPayloadGeneration:forbidden",
  ]);

  return {
    mode: "runtime_controlled_pilot_execution_input_contract",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    contractRows,
    recommendations: mergeSortedUniqueKo([
      "H45: controlled pilot execution input contract — upstream pilot execution readiness metadata only",
    ]),
  };
}
