/**
 * H43 — pilot contract **hardening boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  PILOT_CONTRACT_FORBIDDEN_BOUNDARY_OPERATIONS,
  PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
  PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotReadinessReviewConstants";
import type { RuntimePilotContractHardeningBoundary } from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimePilotContractHardeningBoundary(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
): RuntimePilotContractHardeningBoundary {
  const pilotFinalGate = reports.runtimeLimitedPilotBoundaryFinalSafetyGate;

  return {
    mode: "runtime_pilot_contract_hardening_boundary",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
    boundaryTargetLayer: PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
    requiredBoundaryInputs: mergeSortedUniqueKo([
      "runtimeLimitedPilotBoundaryFinalSafetyGate",
      "runtimeLimitedPilotBoundarySummary",
      "runtimeLimitedPilotBoundaryPolicy",
      "runtimeLimitedPilotBoundaryVerificationReport",
      "runtimeLimitedPilotBoundaryAlignmentReport",
      "runtimeLimitedPilotBoundaryViolationReport",
      "runtimeLimitedPilotInputContract",
      "runtimeLimitedPilotOutputContract",
      "runtimeControlledActivationCandidateFinalSafetyGate",
      "runtimeUltimateGovernanceReviewFinalSafetyGate",
    ]),
    expectedBoundaryOutputs: mergeSortedUniqueKo([
      "runtimeLimitedPilotReadinessReviewSummary",
      "runtimePilotContractHardeningBoundary",
      "runtimePilotReadinessInputEnvelope",
      "runtimePilotReadinessOutputEnvelope",
      `pilotBoundaryFinalGate:${pilotFinalGate.finalGateStatus}`,
      `h43EntryReadiness:${pilotFinalGate.h43EntryReadiness}`,
    ]),
    allowedBoundaryScopes: mergeSortedUniqueKo([
      "limited_pilot_readiness_review_status",
      "pilot_contract_hardening_metadata_only",
      "pilot_no_execution_proof",
      "pilot_execution_forbidden_proof",
      `h43EntryReadiness:${pilotFinalGate.h43EntryReadiness}`,
    ]),
    forbiddenBoundaryOperations: [...PILOT_CONTRACT_FORBIDDEN_BOUNDARY_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H43: pilot contract hardening boundary — metadata only(실제 pilot activation·execution·runner·adapter·sandbox 없음)",
    ]),
  };
}
