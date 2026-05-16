/**
 * H31 — no-op execution shell candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellCandidateStatus,
  RuntimeNoopExecutionShellPolicy,
} from "./runtimeNoopExecutionShellTypes";
import { resolveRuntimeNoopExecutionShellMode } from "./resolveRuntimeNoopExecutionShellMode";

export function buildRuntimeNoopExecutionShellPolicy(input: {
  readonly candidateStatus: RuntimeNoopExecutionShellCandidateStatus;
}): RuntimeNoopExecutionShellPolicy {
  const shellAllowedMode = resolveRuntimeNoopExecutionShellMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualShellExecutionForbidden:true — metadata_only shell candidate만 허용",
    "actualRunnerInvocationForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualExecutionForbidden:true",
    ...(shellAllowedMode === "metadata_only"
      ? ["H31: shell policy metadata_only — harness final gate·operator review 선행(집행 없음)"]
      : []),
    ...(shellAllowedMode === "blocked"
      ? ["H31: shell policy blocked — harness·alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_execution_shell_policy",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    shellAllowedMode,
    operatorReviewBeforeShell: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualShellExecutionForbidden: true,
    actualRunnerInvocationForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualExecutionForbidden: true,
    recommendations,
  };
}
