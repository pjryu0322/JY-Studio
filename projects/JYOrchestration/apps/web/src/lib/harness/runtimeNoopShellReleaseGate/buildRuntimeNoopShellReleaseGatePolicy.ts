/**
 * H34 — release-gate candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellReleaseGateCandidateStatus,
  RuntimeNoopShellReleaseGatePolicy,
} from "./runtimeNoopShellReleaseGateTypes";
import { resolveRuntimeNoopShellReleaseGateMode } from "./resolveRuntimeNoopShellReleaseGateMode";

export function buildRuntimeNoopShellReleaseGatePolicy(input: {
  readonly candidateStatus: RuntimeNoopShellReleaseGateCandidateStatus;
}): RuntimeNoopShellReleaseGatePolicy {
  const releaseGateAllowedMode = resolveRuntimeNoopShellReleaseGateMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualReleaseEnforcementForbidden:true — metadata_only release-gate candidate만 허용",
    "actualShellExecutionForbidden:true",
    "actualExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    ...(releaseGateAllowedMode === "metadata_only"
      ? ["H34: release-gate policy metadata_only — hardening final gate·operator review 선행(집행 없음)"]
      : []),
    ...(releaseGateAllowedMode === "blocked"
      ? ["H34: release-gate policy blocked — hardening·alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_policy",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    releaseGateAllowedMode,
    operatorReviewBeforeReleaseGate: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualReleaseEnforcementForbidden: true,
    actualShellExecutionForbidden: true,
    actualExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    recommendations,
  };
}
