/**
 * H25 — no-op adapter **result** metadata(read-only; 실제 adapter 결과 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopAdapterResultMetadata } from "./runtimeNoopAdapterTypes";

export function buildRuntimeNoopAdapterResultMetadata(): RuntimeNoopAdapterResultMetadata {
  const resultRows = mergeSortedUniqueKo([
    "noopAccepted=false",
    "adapterInvoked=false",
    "executionPerformed=false",
    "providerRoutingPerformed=false",
    "queueControlPerformed=false",
    "rollbackPerformed=false",
    "diagnosticOnly=true",
  ]);

  return {
    mode: "runtime_noop_adapter_result_metadata",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    noopAccepted: false,
    adapterInvoked: false,
    executionPerformed: false,
    providerRoutingPerformed: false,
    queueControlPerformed: false,
    rollbackPerformed: false,
    diagnosticOnly: true,
    resultRows,
  };
}
