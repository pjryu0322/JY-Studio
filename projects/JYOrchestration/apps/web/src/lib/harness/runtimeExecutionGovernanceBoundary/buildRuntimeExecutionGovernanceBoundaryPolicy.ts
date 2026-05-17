/**
 * H37 — governance boundary **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
  RuntimeExecutionGovernanceBoundaryPolicy,
} from "./runtimeExecutionGovernanceBoundaryTypes";
import { resolveRuntimeExecutionGovernanceBoundaryMode } from "./resolveRuntimeExecutionGovernanceBoundaryMode";

export function buildRuntimeExecutionGovernanceBoundaryPolicy(input: {
  readonly candidateStatus: RuntimeExecutionGovernanceBoundaryCandidateStatus;
}): RuntimeExecutionGovernanceBoundaryPolicy {
  const governanceAllowedMode = resolveRuntimeExecutionGovernanceBoundaryMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualExecutionForbidden:true — metadata_only governance boundary candidate만 허용",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
    "actualApprovalEnforcementForbidden:true",
    ...(governanceAllowedMode === "metadata_only"
      ? ["H37: governance boundary policy metadata_only — operator review·rollback 선행(집행 없음)"]
      : []),
    ...(governanceAllowedMode === "blocked"
      ? ["H37: governance boundary policy blocked — execution boundary shell final gate·alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_governance_boundary_policy",
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
    governanceAllowedMode,
    operatorReviewBeforeGovernanceBoundary: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualApprovalEnforcementForbidden: true,
    recommendations,
  };
}
