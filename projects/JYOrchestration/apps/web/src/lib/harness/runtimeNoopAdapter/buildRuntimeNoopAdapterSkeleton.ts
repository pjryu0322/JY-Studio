/**
 * H25 — no-op runtime adapter **skeleton** metadata(read-only; 함수·provider 호출 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopAdapterSkeleton } from "./runtimeNoopAdapterTypes";

export function buildRuntimeNoopAdapterSkeleton(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter
): RuntimeNoopAdapterSkeleton {
  const contract = reports.runtimePilotContractSummary;
  const boundary = reports.runtimeAdapterBoundarySummary;
  const forbidden = reports.runtimeAdapterForbiddenOperationReport;

  return {
    mode: "runtime_noop_adapter_skeleton",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    adapterName: "JYOrchestrationNoopRuntimeAdapterSkeleton",
    adapterMode: "noop",
    acceptedContractInputs: mergeSortedUniqueKo([...contract.contractInputRequirements]),
    expectedNoopOutputs: mergeSortedUniqueKo([...contract.contractOutputExpectations]),
    forbiddenOperations: mergeSortedUniqueKo([...forbidden.forbiddenOperations]),
    noOpGuarantees: mergeSortedUniqueKo([...boundary.noOpGuarantees]),
  };
}
