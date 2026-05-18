/**
 * H24.5 — H25 handoff **readiness** metadata(read-only; actual handoff 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterBoundarySummary,
  RuntimeAdapterForbiddenOperationReport,
  RuntimePilotContractSummary,
  RuntimePilotHandoffReadiness,
} from "./runtimePilotContractTypes";

export function buildRuntimePilotHandoffReadiness(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract,
  contract: RuntimePilotContractSummary,
  boundary: RuntimeAdapterBoundarySummary,
  forbidden: RuntimeAdapterForbiddenOperationReport
): RuntimePilotHandoffReadiness {
  const cp = reports.runtimeControlledPilotSummary;
  const a = reports.runtimeOperatorApprovalSummary;
  const r = reports.runtimeRollbackReadinessSummary;
  const u = reports.runtimeAuditReadinessSummary;

  let handoffReadiness: RuntimePilotHandoffReadiness["handoffReadiness"];
  if (contract.contractReadiness === "blocked" || boundary.boundaryMode === "handoff_blocked") {
    handoffReadiness = "blocked";
  } else if (contract.contractReadiness === "contract_metadata_ready" && forbidden.wordingRiskFindings.length === 0) {
    handoffReadiness = "metadata_ready";
  } else if (contract.contractReadiness === "watch") {
    handoffReadiness = "metadata_watch";
  } else {
    handoffReadiness = "not_ready";
  }

  const handoffBlockers = mergeSortedUniqueKo([
    ...contract.handoffBlockers,
    ...(forbidden.wordingRiskFindings.length > 0 ? ["forbidden operation wording risk"] : []),
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...contract.recommendations,
    ...boundary.recommendations,
    ...forbidden.recommendations,
  ]);

  return {
    mode: "runtime_pilot_handoff_readiness",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    handoffReadiness,
    contractReadiness: contract.contractReadiness,
    adapterBoundaryMode: boundary.boundaryMode,
    controlledPilotReadiness: cp.readiness,
    operatorApprovalReadiness: a.approvalReadiness,
    rollbackReadiness: r.rollbackReadiness,
    auditReadiness: u.auditReadiness,
    handoffBlockers,
    recommendations,
  };
}
