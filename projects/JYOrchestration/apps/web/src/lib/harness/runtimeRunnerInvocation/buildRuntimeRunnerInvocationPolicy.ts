/**
 * H29 — runner invocation candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerInvocationCandidateStatus,
  RuntimeRunnerInvocationPolicy,
} from "./runtimeRunnerInvocationTypes";
import { resolveRuntimeRunnerInvocationMode } from "./resolveRuntimeRunnerInvocationMode";

export function buildRuntimeRunnerInvocationPolicy(input: {
  readonly candidateStatus: RuntimeRunnerInvocationCandidateStatus;
}): RuntimeRunnerInvocationPolicy {
  const invocationAllowedMode = resolveRuntimeRunnerInvocationMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualInvocationForbidden:true — metadata_only invocation candidate만 허용",
    ...(invocationAllowedMode === "metadata_only"
      ? ["H29: invocation policy metadata_only — contract·guard·no-execution·operator review 선행(집행 없음)"]
      : []),
    ...(invocationAllowedMode === "blocked"
      ? ["H29: invocation policy blocked — skeleton preflight·contract 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_runner_invocation_policy",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    invocationAllowedMode,
    operatorReviewBeforeInvocation: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    runnerContractRequired: true,
    runnerSafetyGuardRequired: true,
    runnerNoExecutionResultRequired: true,
    actualInvocationForbidden: true,
    recommendations,
  };
}
