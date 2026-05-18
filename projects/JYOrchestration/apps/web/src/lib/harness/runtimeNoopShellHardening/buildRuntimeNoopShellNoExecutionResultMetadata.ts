/**
 * H33 — shell hardening **no-execution result** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopShellNoExecutionResultMetadata } from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellNoExecutionResultMetadata(): RuntimeNoopShellNoExecutionResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "noopShellExecuted:false",
    "executionShellExecuted:false",
    "runtimeAdapterInvoked:false",
    "executionPerformed:false",
    "providerRoutingPerformed:false",
    "queueControlPerformed:false",
    "rollbackPerformed:false",
    "promptMutated:false",
    "diagnosticOnly:true",
    "hardening:metadata_only",
  ]);

  return {
    mode: "runtime_noop_shell_no_execution_result_metadata",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    noopShellExecuted: false,
    executionShellExecuted: false,
    runtimeAdapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    promptMutated: false,
    diagnosticOnly: true,
    resultRows,
    recommendations: mergeSortedUniqueKo([
      "H33: shell no-execution result — 모든 execution·routing·rollback·prompt 변경 경로 false",
    ]),
  };
}
