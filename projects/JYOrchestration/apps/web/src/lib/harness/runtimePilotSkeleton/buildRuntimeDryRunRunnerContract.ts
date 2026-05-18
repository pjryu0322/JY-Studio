/**
 * H28 — isolated **dry-run runner contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeDryRunRunnerContract, RuntimePilotSkeletonReadiness } from "./runtimePilotSkeletonTypes";

const FORBIDDEN_RUNNER_OPERATIONS = [
  "actual isolated runner execution",
  "actual dry-run runner execution",
  "actual runtime adapter invocation",
  "actual pilot execution",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual prompt mutation",
] as const;

export function buildRuntimeDryRunRunnerContract(input: {
  readonly skeletonReadiness: RuntimePilotSkeletonReadiness;
}): RuntimeDryRunRunnerContract {
  const { skeletonReadiness } = input;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimePilotActivationFinalSafetyGate",
    "runtimePilotActivationSummary",
    "runtimePilotActivationScope",
    "runtimePilotActivationPolicy",
    "runtimePilotActivationReadinessVerificationReport",
    "runtimePilotActivationBoundaryViolationReport",
    "runtimeAdapterSandboxPreflightSummary",
    "runtimePilotContractSummary",
    "runtimeNoopAdapterPreflightSummary",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    "runtimeControlBoundarySummary",
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimePilotRunnerOutputEnvelope",
    "runnerAcceptedMetadata",
    "runnerRejectedMetadata",
    "runnerSafetyValidationMetadata",
    "runnerNoExecutionResultMetadata",
    "runnerBlockerMetadata",
    "runnerAuditTraceMetadata",
  ]);

  const runnerNoExecutionGuarantees = mergeSortedUniqueKo([
    "actualIsolatedRunnerExecutionEnabled:false",
    "actualDryRunRunnerExecutionEnabled:false",
    "runnerInvoked:false",
    "executionPerformed:false",
    "diagnosticOnly:true",
    "H28: dry_run_contract_only is not runner permission",
  ]);

  const recommendations = mergeSortedUniqueKo([
    "H28: dry-run runner contract — metadata envelope only(실제 runner 호출 없음)",
    ...(skeletonReadiness === "skeleton_metadata_ready"
      ? ["H29: isolated dry-run runner 논의 전 contract gate 유지"]
      : []),
  ]);

  return {
    mode: "runtime_dry_run_runner_contract",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    runnerName: "controlled_runtime_pilot_dry_run_runner",
    runnerMode: "dry_run_contract_only",
    requiredInputMetadata,
    expectedOutputMetadata,
    forbiddenRunnerOperations: [...FORBIDDEN_RUNNER_OPERATIONS],
    runnerNoExecutionGuarantees,
    recommendations,
  };
}
