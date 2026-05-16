/**
 * H30 — runner **no-op result** metadata(read-only; 실제 runner 결과 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeRunnerNoopResultMetadata } from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopResultMetadata(): RuntimeRunnerNoopResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "isolatedRunnerInvoked=false",
    "isolatedRunnerExecuted=false",
    "dryRunRunnerInvoked=false",
    "dryRunRunnerExecuted=false",
    "runtimeAdapterInvoked=false",
    "executionPerformed=false",
    "providerRoutingPerformed=false",
    "queueControlPerformed=false",
    "rollbackPerformed=false",
    "promptMutated=false",
    "diagnosticOnly=true",
  ]);

  return {
    mode: "runtime_runner_noop_result_metadata",
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
    isolatedRunnerInvoked: false,
    isolatedRunnerExecuted: false,
    dryRunRunnerInvoked: false,
    dryRunRunnerExecuted: false,
    runtimeAdapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    promptMutated: false,
    diagnosticOnly: true,
    resultRows,
    recommendations: mergeSortedUniqueKo([
      "H30: no-op result metadata — diagnostic only(실제 runner invocation·execution 없음)",
    ]),
  };
}
