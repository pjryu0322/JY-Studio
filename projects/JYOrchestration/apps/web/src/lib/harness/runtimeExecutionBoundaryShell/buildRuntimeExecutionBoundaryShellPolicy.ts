/**
 * H36 — execution boundary shell **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionBoundaryShellCandidateStatus,
  RuntimeExecutionBoundaryShellPolicy,
} from "./runtimeExecutionBoundaryShellTypes";
import { resolveRuntimeExecutionBoundaryShellMode } from "./resolveRuntimeExecutionBoundaryShellMode";

export function buildRuntimeExecutionBoundaryShellPolicy(input: {
  readonly candidateStatus: RuntimeExecutionBoundaryShellCandidateStatus;
}): RuntimeExecutionBoundaryShellPolicy {
  const shellAllowedMode = resolveRuntimeExecutionBoundaryShellMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualExecutionForbidden:true — metadata_only boundary shell candidate만 허용",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
    ...(shellAllowedMode === "metadata_only"
      ? ["H36: execution boundary shell policy metadata_only — operator review·rollback 선행(집행 없음)"]
      : []),
    ...(shellAllowedMode === "blocked"
      ? ["H36: execution boundary shell policy blocked — preflight final gate·alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_boundary_shell_policy",
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
    shellAllowedMode,
    operatorReviewBeforeExecutionBoundary: true,
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
    recommendations,
  };
}
