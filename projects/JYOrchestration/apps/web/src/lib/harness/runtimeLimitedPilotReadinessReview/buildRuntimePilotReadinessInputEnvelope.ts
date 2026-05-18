/**
 * H43 — pilot readiness **input envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import type { RuntimePilotReadinessInputEnvelope } from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimePilotReadinessInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
): RuntimePilotReadinessInputEnvelope {
  const finalGate = reports.runtimeLimitedPilotBoundaryFinalSafetyGate;
  const activationFinalGate = reports.runtimeControlledActivationCandidateFinalSafetyGate;
  const ultimateFinalGate = reports.runtimeUltimateGovernanceReviewFinalSafetyGate;

  const envelopeRows = mergeSortedUniqueKo([
    `limitedPilotBoundaryFinalGate:${finalGate.finalGateStatus}`,
    `h43EntryReadiness:${finalGate.h43EntryReadiness}`,
    `limitedPilotBoundaryCandidate:${reports.runtimeLimitedPilotBoundarySummary.candidateStatus}`,
    `limitedPilotBoundaryMode:${reports.runtimeLimitedPilotBoundarySummary.pilotBoundaryMode}`,
    `limitedPilotVerification:${reports.runtimeLimitedPilotBoundaryVerificationReport.verificationStatus}`,
    `limitedPilotAlignment:${reports.runtimeLimitedPilotBoundaryAlignmentReport.alignmentStatus}`,
    `limitedPilotViolationCount:${reports.runtimeLimitedPilotBoundaryViolationReport.actualFlagViolations.length + reports.runtimeLimitedPilotBoundaryViolationReport.policyViolations.length}`,
    `limitedPilotInputContractRows:${reports.runtimeLimitedPilotInputContract.contractRows.length}`,
    `limitedPilotOutputContractRows:${reports.runtimeLimitedPilotOutputContract.contractRows.length}`,
    `activationFinalGate:${activationFinalGate.finalGateStatus}`,
    `ultimateFinalGate:${ultimateFinalGate.finalGateStatus}`,
    `operatorApproval:${reports.runtimeOperatorApprovalSummary.approvalReadiness}`,
    `rollbackReadiness:${reports.runtimeRollbackReadinessSummary.rollbackReadiness}`,
    `auditReadiness:${reports.runtimeAuditReadinessSummary.auditReadiness}`,
    "pilotPayloadGeneration:forbidden",
    "executionPayloadGeneration:forbidden",
    "adapterInvocationPayloadGeneration:forbidden",
  ]);

  return {
    mode: "runtime_pilot_readiness_input_envelope",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H43: pilot readiness input envelope — upstream limited pilot boundary·approval metadata only",
    ]),
  };
}
