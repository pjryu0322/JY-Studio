/**
 * H24.5 — 향후 runtime adapter **출력 contract schema** metadata(read-only; adapter output 생성 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotContractOutputSchema } from "./runtimePilotContractTypes";

export function buildRuntimePilotContractOutputSchema(): RuntimePilotContractOutputSchema {
  const expectedFields = mergeSortedUniqueKo([
    "pilotAcceptedMetadata",
    "pilotRejectedMetadata",
    "noOpResultMetadata",
    "safetyValidationResultMetadata",
    "handoffBlockedReasonMetadata",
    "auditTraceReferenceMetadata",
  ]);

  const noOpResultMetadata = mergeSortedUniqueKo([
    "adapterInvocationSkipped: true",
    "executionHandoff: none",
    "providerRoutingHandoff: none",
    "queueControlHandoff: none",
    "rollbackHandoff: none",
  ]);

  return {
    mode: "runtime_pilot_contract_output_schema",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    expectedFields,
    noOpResultMetadata,
    notesKo: "실제 adapter output·실행 결과 없음. no-op boundary만 정의.",
  };
}
