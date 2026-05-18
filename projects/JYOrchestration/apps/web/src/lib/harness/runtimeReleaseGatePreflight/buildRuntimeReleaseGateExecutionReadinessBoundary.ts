/**
 * H35 — **execution readiness boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeReleaseGateExecutionReadinessBoundary } from "./runtimeReleaseGatePreflightTypes";

const FORBIDDEN_BOUNDARY_OPERATIONS = [
  "actual release enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual execution",
  "provider routing",
  "queue control",
  "rollback execution",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "merge blocking",
] as const;

export function buildRuntimeReleaseGateExecutionReadinessBoundary(): RuntimeReleaseGateExecutionReadinessBoundary {
  const recommendations = mergeSortedUniqueKo([
    "H35: execution readiness boundary — controlled release-gate final preflight(집행 없음)",
  ]);

  return {
    mode: "runtime_release_gate_execution_readiness_boundary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    boundarySourceLayer: "runtimeNoopShellReleaseGateFinalSafetyGate",
    boundaryTargetLayer: "controlledReleaseGateFinalPreflight",
    allowedBoundaryScopes: mergeSortedUniqueKo([
      "release_gate_preflight_metadata",
      "execution_readiness_boundary_metadata",
      "no_execution_proof",
      "operation_forbidden_proof",
      "h36EntryReadiness:metadata_only_gate",
    ]),
    requiredBoundaryInputs: mergeSortedUniqueKo([
      "runtimeNoopShellReleaseGateFinalSafetyGate",
      "runtimeNoopShellReleaseGateReadinessVerificationReport",
      "runtimeNoopShellReleaseGateAlignmentReport",
      "runtimeNoopShellReleaseGateBoundaryViolationReport",
    ]),
    expectedBoundaryOutputs: mergeSortedUniqueKo([
      "runtimeReleaseGatePreflightSummary",
      "runtimeReleaseGateExecutionReadinessBoundary",
      "runtimeReleaseGateInputEnvelope",
      "runtimeReleaseGateOutputEnvelope",
      "runtimeReleaseGateNoExecutionProof",
      "runtimeReleaseGateOperationForbiddenProof",
    ]),
    forbiddenBoundaryOperations: [...FORBIDDEN_BOUNDARY_OPERATIONS],
    recommendations,
  };
}
