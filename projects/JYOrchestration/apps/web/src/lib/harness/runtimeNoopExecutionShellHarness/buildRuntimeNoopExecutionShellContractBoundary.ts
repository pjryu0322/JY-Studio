/**
 * H32 — execution shell harness **contract boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopExecutionShellContractBoundary } from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellContractBoundary(): RuntimeNoopExecutionShellContractBoundary {
  const allowedContractScopes = mergeSortedUniqueKo([
    "shell_contract_boundary_metadata_only",
    "controlled_noop_execution_shell_harness",
    "execution_shell_final_safety_gate_reference",
  ]);

  const requiredContractInputs = mergeSortedUniqueKo([
    "runtimeNoopExecutionShellFinalSafetyGate",
    "runtimeNoopExecutionShellSummary",
    "runtimeNoopExecutionShellScope",
    "runtimeNoopExecutionShellPolicy",
    "runtimeNoopExecutionShellReadinessVerificationReport",
    "runtimeNoopExecutionShellBoundaryViolationReport",
    "runtimeRunnerNoopHarnessFinalSafetyGate",
    "runtimeRunnerNoopHarnessAlignmentReport",
  ]);

  const expectedContractOutputs = mergeSortedUniqueKo([
    "shellAcceptedMetadata",
    "shellRejectedMetadata",
    "shellSafetyValidationMetadata",
    "shellNoopResultMetadata",
    "shellBlockerMetadata",
    "shellAuditTraceMetadata",
  ]);

  const forbiddenContractOperations = mergeSortedUniqueKo([
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
  ]);

  return {
    mode: "runtime_noop_execution_shell_contract_boundary",
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
    boundarySourceLayer: "runtimeNoopExecutionShellFinalSafetyGate",
    boundaryTargetLayer: "controlledNoopExecutionShellHarness",
    allowedContractScopes,
    requiredContractInputs,
    expectedContractOutputs,
    forbiddenContractOperations,
    recommendations: mergeSortedUniqueKo([
      "H32: execution shell contract boundary — shell_contract_only(실제 shell execution 없음)",
    ]),
  };
}
