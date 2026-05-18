/**
 * H39 — final release governance gate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeFinalReleaseGovernanceGateCandidateStatus,
  RuntimeFinalReleaseGovernanceGatePolicy,
} from "./runtimeFinalReleaseGovernanceGateTypes";
import { resolveRuntimeFinalReleaseGovernanceGateMode } from "./resolveRuntimeFinalReleaseGovernanceGateMode";

export function buildRuntimeFinalReleaseGovernanceGatePolicy(input: {
  readonly candidateStatus: RuntimeFinalReleaseGovernanceGateCandidateStatus;
}): RuntimeFinalReleaseGovernanceGatePolicy {
  const gateAllowedMode = resolveRuntimeFinalReleaseGovernanceGateMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualExecutionForbidden:true — metadata_only final release governance gate candidate만 허용",
    "actualExecutionBlockingForbidden:true",
    "actualMergeBlockingForbidden:true",
    ...(gateAllowedMode === "metadata_only"
      ? ["H39: final release governance gate policy metadata_only — operator review·rollback 선행(enforcement 없음)"]
      : []),
    ...(gateAllowedMode === "blocked"
      ? ["H39: final release governance gate policy blocked — governance release-readiness final gate 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_final_release_governance_gate_policy",
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
    actualExecutionBlockingEnabled: false,
    actualMergeBlockingEnabled: false,
    gateAllowedMode,
    operatorReviewBeforeFinalReleaseGate: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualApprovalEnforcementForbidden: true,
    actualShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualExecutionBlockingForbidden: true,
    actualMergeBlockingForbidden: true,
    recommendations,
  };
}
