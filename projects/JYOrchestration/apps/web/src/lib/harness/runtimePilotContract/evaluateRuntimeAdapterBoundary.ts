/**
 * H24.5 — runtime adapter **boundary mode**(read-only; actualRuntimeAdapterInvocationEnabled 항상 false).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterBoundaryMode, RuntimeAdapterBoundarySummary } from "./runtimePilotContractTypes";

export function evaluateRuntimeAdapterBoundary(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract
): RuntimeAdapterBoundarySummary {
  const cp = reports.runtimeControlledPilotSummary;

  let boundaryMode: RuntimeAdapterBoundaryMode;
  if (cp.readiness === "blocked" || cp.pilotScope === "blocked") {
    boundaryMode = "handoff_blocked";
  } else if (cp.readiness === "metadata_ready" && cp.safetyBlockers.length === 0) {
    boundaryMode = "contract_metadata_only";
  } else {
    boundaryMode = "no_op_only";
  }

  const rationaleKo =
    boundaryMode === "handoff_blocked"
      ? "controlled pilot blocked — runtime adapter handoff 금지(no-op 유지)."
      : boundaryMode === "contract_metadata_only"
        ? "contract 메타만 허용 — adapter는 no-op boundary 내 metadata만(실제 호출 없음)."
        : "기본 no-op boundary — execution·routing·rollback handoff 없음.";

  const noOpGuarantees = mergeSortedUniqueKo([
    "No-op runtime adapter boundary",
    "No execution handoff",
    "No provider routing handoff",
    "No queue control handoff",
    "No rollback handoff",
    "actualRuntimeAdapterInvocationEnabled=false",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(boundaryMode === "handoff_blocked"
      ? ["H24.5: adapter handoff 차단 — pilot·승인·경계 정렬 후 contract 재평가"]
      : []),
    ...(boundaryMode === "contract_metadata_only"
      ? ["H24.5: contract 메타만 — H25 전 forbidden operation 스캔 유지"]
      : []),
  ]);

  return {
    mode: "runtime_adapter_boundary_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    boundaryMode,
    rationaleKo,
    noOpGuarantees,
    recommendations,
  };
}
