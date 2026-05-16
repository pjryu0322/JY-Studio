/**
 * H26 — sandbox **result placeholder** metadata(read-only; 실제 sandbox 실행 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterSandboxResultMetadata } from "./runtimeAdapterSandboxTypes";

export function buildRuntimeAdapterSandboxResultMetadata(): RuntimeAdapterSandboxResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "sandboxInvoked=false",
    "adapterInvoked=false",
    "executionPerformed=false",
    "providerRoutingPerformed=false",
    "queueControlPerformed=false",
    "rollbackPerformed=false",
    "diagnosticOnly=true",
  ]);

  return {
    mode: "runtime_adapter_sandbox_result_metadata",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    sandboxInvoked: false,
    adapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    diagnosticOnly: true,
    resultRows,
  };
}
