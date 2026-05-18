/**
 * H32 — execution shell harness **no-op result** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopExecutionShellNoopResultMetadata } from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellNoopResultMetadata(): RuntimeNoopExecutionShellNoopResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "noopShellExecuted:false",
    "executionShellExecuted:false",
    "runtimeAdapterInvoked:false",
    "executionPerformed:false",
    "providerRoutingPerformed:false",
    "queueControlPerformed:false",
    "rollbackPerformed:false",
    "promptMutated:false",
    "tokenEnforced:false",
    "contextPruned:false",
    "diagnosticOnly:true",
    "harness:metadata_only",
  ]);

  return {
    mode: "runtime_noop_execution_shell_noop_result_metadata",
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
    noopShellExecuted: false,
    executionShellExecuted: false,
    runtimeAdapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    promptMutated: false,
    tokenEnforced: false,
    contextPruned: false,
    diagnosticOnly: true,
    resultRows,
    recommendations: mergeSortedUniqueKo([
      "H32: execution shell no-op result — 모든 execution·routing·rollback·prompt·token·context 경로 false",
    ]),
  };
}
