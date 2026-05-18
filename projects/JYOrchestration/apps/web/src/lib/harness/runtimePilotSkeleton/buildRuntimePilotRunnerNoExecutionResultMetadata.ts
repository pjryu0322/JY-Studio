/**
 * H28.5 — runner **no-execution result** metadata(read-only; 실제 runner 결과 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotRunnerNoExecutionResultMetadata } from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotRunnerNoExecutionResultMetadata(): RuntimePilotRunnerNoExecutionResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "runnerExecuted=false",
    "dryRunRunnerExecuted=false",
    "adapterInvoked=false",
    "executionPerformed=false",
    "providerRoutingPerformed=false",
    "queueControlPerformed=false",
    "rollbackPerformed=false",
    "diagnosticOnly=true",
  ]);

  return {
    mode: "runtime_pilot_runner_no_execution_result_metadata",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    runnerExecuted: false,
    dryRunRunnerExecuted: false,
    adapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    diagnosticOnly: true,
    resultRows,
    recommendations: mergeSortedUniqueKo([
      "H28.5: runner no-execution result — diagnostic metadata only(실제 runner 호출 없음)",
    ]),
  };
}
