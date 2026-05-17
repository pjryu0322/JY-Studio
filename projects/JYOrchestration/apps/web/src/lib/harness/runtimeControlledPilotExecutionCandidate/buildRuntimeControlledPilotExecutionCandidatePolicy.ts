/**
 * H45 — controlled pilot execution candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateStatus,
} from "./runtimeControlledPilotExecutionCandidateTypes";
import { resolveRuntimeControlledPilotExecutionMode } from "./resolveRuntimeControlledPilotExecutionMode";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";

export function buildRuntimeControlledPilotExecutionCandidatePolicy(input: {
  readonly candidateStatus: RuntimeControlledPilotExecutionCandidateStatus;
}): RuntimeControlledPilotExecutionCandidatePolicy {
  const executionAllowedMode = resolveRuntimeControlledPilotExecutionMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualPilotActivationForbidden:true — metadata_only candidate만 허용",
    "actualPilotExecutionForbidden:true",
    "actualIsolatedRunnerInvocationForbidden:true",
    "actualSandboxInvocationForbidden:true",
    "actualExecutionForbidden:true",
    ...(executionAllowedMode === "metadata_only"
      ? [
          "H45: controlled pilot execution policy metadata_only — operator review·rollback·audit 선행(pilot activation·execution 없음)",
        ]
      : []),
    ...(executionAllowedMode === "blocked"
      ? ["H45: controlled pilot execution policy blocked — pilot execution readiness final gate 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_controlled_pilot_execution_candidate_policy",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    executionAllowedMode,
    operatorReviewBeforeControlledPilotExecution: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualRuntimeOrchestrationForbidden: true,
    actualControlledActivationForbidden: true,
    actualPilotActivationForbidden: true,
    actualPilotExecutionForbidden: true,
    actualIsolatedRunnerInvocationForbidden: true,
    actualIsolatedRunnerExecutionForbidden: true,
    actualDryRunRunnerInvocationForbidden: true,
    actualDryRunRunnerExecutionForbidden: true,
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
