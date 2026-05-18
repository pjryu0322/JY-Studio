/**
 * H24.5 — controlled pilot 메타 기반 **pilot contract summary**(read-only; adapter 실행 허가 아님).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotContractReadiness, RuntimePilotContractSummary } from "./runtimePilotContractTypes";
import { evaluateRuntimeAdapterBoundary } from "./evaluateRuntimeAdapterBoundary";

export function buildRuntimePilotContractSummary(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract
): RuntimePilotContractSummary {
  const cp = reports.runtimeControlledPilotSummary;
  const boundary = evaluateRuntimeAdapterBoundary(reports);

  let contractReadiness: RuntimePilotContractReadiness;
  if (cp.readiness === "blocked" || boundary.boundaryMode === "handoff_blocked") {
    contractReadiness = "blocked";
  } else if (cp.readiness === "watch") {
    contractReadiness = "watch";
  } else if (
    cp.readiness === "metadata_ready" &&
    cp.pilotScope === "single_flow_metadata" &&
    cp.safetyBlockers.length === 0
  ) {
    contractReadiness = "contract_metadata_ready";
  } else {
    contractReadiness = "not_ready";
  }

  const contractInputRequirements = mergeSortedUniqueKo([
    "projectId 또는 project scope reference(메타)",
    "candidate flow metadata(H24)",
    "control boundary summary(H22.5)",
    "execution candidate summary(H23)",
    "operator approval summary(H23.5)",
    "rollback readiness summary(H23.5)",
    "audit readiness summary(H23.5)",
    "controlled pilot safety envelope(H24)",
    "abort condition metadata(H24)",
  ]);

  const contractOutputExpectations = mergeSortedUniqueKo([
    "pilot accepted/rejected metadata(실행 없음)",
    "no-op result metadata",
    "safety validation result metadata",
    "handoff blocked reason metadata",
    "audit trace reference metadata(저장 없음)",
  ]);

  const handoffBlockers = mergeSortedUniqueKo([
    ...cp.safetyBlockers,
    ...(contractReadiness === "blocked" ? ["controlled pilot 또는 contract readiness blocked"] : []),
    ...(boundary.boundaryMode === "handoff_blocked" ? ["adapter boundary: handoff_blocked"] : []),
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...cp.recommendations,
    ...(contractReadiness === "contract_metadata_ready"
      ? ["H24.5: contract 메타만 — runtime adapter invocation 금지 유지"]
      : []),
    ...(contractReadiness === "blocked" ? ["H24.5: handoff 차단 — 선행 pilot·승인·경계 해소"] : []),
  ]);

  const runtimePilotContractSummary: RuntimePilotContractSummary = {
    mode: "runtime_pilot_contract_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    contractReadiness,
    adapterBoundaryMode: boundary.boundaryMode,
    contractInputRequirements,
    contractOutputExpectations,
    handoffBlockers,
    recommendations,
  };

  return runtimePilotContractSummary;
}
