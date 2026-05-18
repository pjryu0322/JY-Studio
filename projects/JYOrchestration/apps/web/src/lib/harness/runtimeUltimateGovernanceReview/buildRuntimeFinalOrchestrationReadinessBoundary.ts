/**
 * H40 — final orchestration readiness **boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER,
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER,
  FINAL_ORCHESTRATION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeUltimateGovernanceReviewConstants";
import type { RuntimeFinalOrchestrationReadinessBoundary } from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeFinalOrchestrationReadinessBoundary(): RuntimeFinalOrchestrationReadinessBoundary {
  return {
    mode: "runtime_final_orchestration_readiness_boundary",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER,
    boundaryTargetLayer: FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER,
    allowedBoundaryScopes: mergeSortedUniqueKo([
      "ultimate_governance_review_metadata",
      "final_orchestration_readiness_boundary",
      "ultimate_no_enforcement_proof",
      "orchestration_forbidden_proof",
      "h40_5EntryReadiness:metadata_only_boundary",
    ]),
    requiredBoundaryInputs: mergeSortedUniqueKo([
      "runtimeFinalReleaseGovernanceGateFinalSafetyGate",
      "runtimeFinalReleaseGovernanceGateSummary",
      "runtimeFinalReleaseGovernanceGatePolicy",
      "runtimeFinalReleaseGovernanceGateVerificationReport",
      "runtimeFinalReleaseGovernanceGateAlignmentReport",
      "runtimeFinalReleaseGovernanceGateViolationReport",
    ]),
    expectedBoundaryOutputs: mergeSortedUniqueKo([
      "runtimeUltimateGovernanceReviewSummary",
      "runtimeFinalOrchestrationReadinessBoundary",
      "runtimeOrchestrationReadinessInputEnvelope",
      "runtimeOrchestrationReadinessOutputEnvelope",
      "runtimeUltimateNoEnforcementProof",
      "runtimeOrchestrationForbiddenProof",
    ]),
    forbiddenBoundaryOperations: [...FINAL_ORCHESTRATION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H40: final orchestration readiness boundary — metadata only(실제 orchestration 없음)",
    ]),
  };
}
