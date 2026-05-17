/**
 * H42 — limited pilot boundary **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import { resolveRuntimeLimitedPilotBoundaryMode } from "./resolveRuntimeLimitedPilotBoundaryMode";
import type {
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundaryCandidateStatus,
} from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotBoundaryPolicy(input: {
  readonly candidateStatus: RuntimeLimitedPilotBoundaryCandidateStatus;
}): RuntimeLimitedPilotBoundaryPolicy {
  const pilotBoundaryAllowedMode = resolveRuntimeLimitedPilotBoundaryMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualPilotActivationForbidden:true — metadata_only candidate만 허용",
    "actualPilotExecutionForbidden:true",
    "actualIsolatedRunnerInvocationForbidden:true",
    "actualSandboxInvocationForbidden:true",
    ...(pilotBoundaryAllowedMode === "metadata_only"
      ? ["H42: limited pilot boundary policy metadata_only — operator review·rollback·audit 선행(pilot 없음)"]
      : []),
    ...(pilotBoundaryAllowedMode === "blocked"
      ? ["H42: limited pilot boundary policy blocked — controlled activation final gate 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_limited_pilot_boundary_policy",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    pilotBoundaryAllowedMode,
    operatorReviewBeforeLimitedPilot: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualRuntimeOrchestrationForbidden: true,
    actualControlledActivationForbidden: true,
    actualPilotActivationForbidden: true,
    actualPilotExecutionForbidden: true,
    actualIsolatedRunnerInvocationForbidden: true,
    actualIsolatedRunnerExecutionForbidden: true,
    actualDryRunRunnerInvocationForbidden: true,
    actualNoopShellExecutionForbidden: true,
    actualExecutionShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualSandboxInvocationForbidden: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualApprovalEnforcementForbidden: true,
    actualExecutionBlockingForbidden: true,
    actualMergeBlockingForbidden: true,
    recommendations,
  };
}
