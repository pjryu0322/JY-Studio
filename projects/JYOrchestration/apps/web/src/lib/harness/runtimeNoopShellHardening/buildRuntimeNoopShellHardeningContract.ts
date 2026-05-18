/**
 * H33 — isolated dry-run no-op execution shell **hardening contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopShellHardeningContract } from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningContract(): RuntimeNoopShellHardeningContract {
  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeNoopExecutionShellFinalSafetyGate",
    "runtimeNoopExecutionShellSummary",
    "runtimeNoopExecutionShellScope",
    "runtimeNoopExecutionShellPolicy",
    "runtimeNoopExecutionShellReadinessVerificationReport",
    "runtimeNoopExecutionShellBoundaryViolationReport",
    "runtimeNoopExecutionShellBlockerReport",
    "runtimeRunnerNoopHarnessFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    "runtimeControlBoundarySummary",
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "hardeningAcceptedMetadata",
    "hardeningRejectedMetadata",
    "hardeningValidationMetadata",
    "hardeningNoExecutionResultMetadata",
    "hardeningBlockerMetadata",
    "hardeningAuditTraceMetadata",
  ]);

  const forbiddenHardeningOperations = mergeSortedUniqueKo([
    "actual no-op shell execution",
    "actual execution shell execution",
    "actual runtime adapter invocation",
    "actual execution",
    "provider routing",
    "queue control",
    "rollback execution",
    "prompt mutation",
  ]);

  const noExecutionGuarantees = mergeSortedUniqueKo([
    "noopShellExecuted:false",
    "executionShellExecuted:false",
    "runtimeAdapterInvoked:false",
    "executionPerformed:false",
    "diagnosticOnly:true",
    "actualShellExecutionForbidden:true",
  ]);

  return {
    mode: "runtime_noop_shell_hardening_contract",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    contractName: "isolatedDryRunNoopExecutionShellHardeningContract",
    contractMode: "contract_verification_only",
    requiredInputMetadata,
    expectedOutputMetadata,
    forbiddenHardeningOperations,
    noExecutionGuarantees,
    recommendations: mergeSortedUniqueKo([
      "H33: shell hardening contract ??contract_verification_only(?�제 shell execution ?�음)",
    ]),
  };
}
