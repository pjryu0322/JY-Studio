/**
 * H33 — shell hardening **output envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellHardeningOutputEnvelope,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningOutputEnvelope(input: {
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
}): RuntimeNoopShellHardeningOutputEnvelope {
  const { summary, result } = input;
  const accepted = summary.hardeningReadiness === "hardening_metadata_ready";

  const envelopeRows = mergeSortedUniqueKo([
    `hardeningAccepted:${accepted}`,
    `hardeningRejected:${!accepted}`,
    `hardeningValidation:${summary.hardeningMode}`,
    `hardeningReadiness:${summary.hardeningReadiness}`,
    `noExecutionDiagnosticOnly:${result.diagnosticOnly}`,
    `noopShellExecuted:${result.noopShellExecuted}`,
    `executionShellExecuted:${result.executionShellExecuted}`,
    `hardeningBlockers:${summary.hardeningBlockers.length}`,
    "hardeningAuditTrace:metadata_only",
    "output:contract_verification_only",
  ]);

  return {
    mode: "runtime_noop_shell_hardening_output_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H33: shell hardening output envelope — acceptance·validation·no-execution result 메타만",
    ]),
  };
}
