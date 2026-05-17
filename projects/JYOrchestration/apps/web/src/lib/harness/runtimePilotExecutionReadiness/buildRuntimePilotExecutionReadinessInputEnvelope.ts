/**
 * H44 — pilot execution readiness **input envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import type { RuntimePilotExecutionReadinessInputEnvelope } from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
): RuntimePilotExecutionReadinessInputEnvelope {
  const reviewFinalGate = reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate;
  const pilotBoundaryFinalGate = reports.runtimeLimitedPilotBoundaryFinalSafetyGate;
  const activationFinalGate = reports.runtimeControlledActivationCandidateFinalSafetyGate;

  const envelopeRows = mergeSortedUniqueKo([
    `reviewFinalGate:${reviewFinalGate.finalGateStatus}`,
    `h44EntryReadiness:${reviewFinalGate.h44EntryReadiness}`,
    `reviewStatus:${reports.runtimeLimitedPilotReadinessReviewSummary.reviewStatus}`,
    `reviewVerification:${reports.runtimeLimitedPilotReadinessReviewVerificationReport.verificationStatus}`,
    `reviewAlignment:${reports.runtimeLimitedPilotReadinessReviewAlignmentReport.alignmentStatus}`,
    `reviewViolationCount:${reports.runtimeLimitedPilotReadinessReviewViolationReport.actualFlagViolations.length + reports.runtimeLimitedPilotReadinessReviewViolationReport.proofViolations.length + reports.runtimeLimitedPilotReadinessReviewViolationReport.forbiddenProofViolations.length}`,
    `pilotContractBoundary:${reports.runtimePilotContractHardeningBoundary.boundaryTargetLayer}`,
    `pilotNoExecutionProof:diagnosticOnly=${reports.runtimePilotNoExecutionProof.diagnosticOnly}`,
    `pilotForbiddenProof:activationForbidden=${reports.runtimePilotExecutionForbiddenProof.actualPilotActivationForbidden}`,
    `limitedPilotBoundaryFinalGate:${pilotBoundaryFinalGate.finalGateStatus}`,
    `activationFinalGate:${activationFinalGate.finalGateStatus}`,
    `operatorApproval:${reports.runtimeOperatorApprovalSummary.approvalReadiness}`,
    `rollbackReadiness:${reports.runtimeRollbackReadinessSummary.rollbackReadiness}`,
    `auditReadiness:${reports.runtimeAuditReadinessSummary.auditReadiness}`,
    "pilotPayloadGeneration:forbidden",
    "executionPayloadGeneration:forbidden",
    "adapterInvocationPayloadGeneration:forbidden",
  ]);

  return {
    mode: "runtime_pilot_execution_readiness_input_envelope",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H44: pilot execution readiness input envelope — upstream limited pilot readiness review metadata only",
    ]),
  };
}
