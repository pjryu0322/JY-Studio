/**
 * H24.5 — 향후 runtime adapter **입력 contract schema** metadata(read-only; payload 생성 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotContractInputSchema } from "./runtimePilotContractTypes";

export function buildRuntimePilotContractInputSchema(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract
): RuntimePilotContractInputSchema {
  const requiredFields = mergeSortedUniqueKo([
    "projectScopeReference",
    "candidateFlowMetadata",
    "controlBoundarySummaryRef",
    "executionCandidateSummaryRef",
    "operatorApprovalSummaryRef",
    "rollbackReadinessSummaryRef",
    "auditReadinessSummaryRef",
    "controlledPilotSafetyEnvelopeRef",
    "abortConditionMetadataRef",
  ]);

  const optionalReferences = mergeSortedUniqueKo([
    `pilotPrecondition:${reports.runtimePilotPreconditionSummary.pilotPreconditionReadiness}`,
    `executionCandidate:${reports.runtimeExecutionCandidateSummary.candidateStatus}`,
    `controlBoundary:${reports.runtimeControlBoundarySummary.boundaryLevel}`,
  ]);

  return {
    mode: "runtime_pilot_contract_input_schema",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    requiredFields,
    optionalReferences,
    notesKo:
      "실제 input payload·LLM·DB 변경 없음. adapter 연동 시 위 필드는 기존 planning report 참조만 허용.",
  };
}
