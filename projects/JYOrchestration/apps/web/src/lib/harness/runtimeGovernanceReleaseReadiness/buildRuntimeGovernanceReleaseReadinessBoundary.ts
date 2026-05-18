/**
 * H38 — final execution governance **readiness boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeGovernanceReleaseReadinessBoundary } from "./runtimeGovernanceReleaseReadinessTypes";

const FORBIDDEN_BOUNDARY_OPERATIONS = [
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "merge blocking",
  "execution blocking",
] as const;

export function buildRuntimeGovernanceReleaseReadinessBoundary(): RuntimeGovernanceReleaseReadinessBoundary {
  return {
    mode: "runtime_governance_release_readiness_boundary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    boundarySourceLayer: "runtimeExecutionGovernanceBoundaryFinalSafetyGate",
    boundaryTargetLayer: "finalExecutionGovernanceReadinessBoundary",
    allowedBoundaryScopes: mergeSortedUniqueKo([
      "governance_release_readiness_metadata",
      "final_execution_governance_readiness_boundary",
      "no_governance_enforcement_proof",
      "execution_governance_forbidden_proof",
      "h39EntryReadiness:metadata_only_gate",
    ]),
    requiredBoundaryInputs: mergeSortedUniqueKo([
      "runtimeExecutionGovernanceBoundaryFinalSafetyGate",
      "runtimeExecutionGovernanceBoundarySummary",
      "runtimeExecutionGovernanceBoundaryPolicy",
      "runtimeExecutionGovernanceBoundaryReadinessVerificationReport",
      "runtimeExecutionGovernanceBoundaryAlignmentReport",
      "runtimeExecutionGovernanceBoundaryViolationReport",
    ]),
    expectedBoundaryOutputs: mergeSortedUniqueKo([
      "runtimeGovernanceReleaseReadinessSummary",
      "runtimeGovernanceReleaseReadinessBoundary",
      "runtimeGovernanceReleaseInputEnvelope",
      "runtimeGovernanceReleaseOutputEnvelope",
      "runtimeGovernanceNoEnforcementProof",
      "runtimeExecutionGovernanceForbiddenProof",
    ]),
    forbiddenBoundaryOperations: [...FORBIDDEN_BOUNDARY_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H38: governance release-readiness boundary — metadata only(실제 governance enforcement 없음)",
    ]),
  };
}
