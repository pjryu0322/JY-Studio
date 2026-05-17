/**
 * H32 — execution shell harness **output envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellHarnessOutputEnvelope,
  RuntimeNoopExecutionShellHarnessSummary,
  RuntimeNoopExecutionShellNoopResultMetadata,
} from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellHarnessOutputEnvelope(input: {
  readonly summary: RuntimeNoopExecutionShellHarnessSummary;
  readonly result: RuntimeNoopExecutionShellNoopResultMetadata;
}): RuntimeNoopExecutionShellHarnessOutputEnvelope {
  const { summary, result } = input;
  const accepted = summary.harnessReadiness === "shell_harness_metadata_ready";

  const envelopeRows = mergeSortedUniqueKo([
    `shellAccepted:${accepted}`,
    `shellRejected:${!accepted}`,
    `shellSafetyValidation:${summary.harnessMode}`,
    `harnessReadiness:${summary.harnessReadiness}`,
    `noopResultDiagnosticOnly:${result.diagnosticOnly}`,
    `noopShellExecuted:${result.noopShellExecuted}`,
    `executionShellExecuted:${result.executionShellExecuted}`,
    `harnessBlockers:${summary.harnessBlockers.length}`,
    "shellAuditTrace:metadata_only",
    "output:shell_contract_only",
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_output_envelope",
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
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H32: execution shell harness output envelope — acceptance·validation·no-op result 메타만",
    ]),
  };
}
