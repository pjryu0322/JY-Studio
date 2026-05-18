/**
 * H25 — adapter invocation guard(read-only; actualRuntimeAdapterInvocationEnabled 항상 false).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopAdapter } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterInvocationGuardReport,
  RuntimeNoopAdapterInvocationGuard,
} from "./runtimeNoopAdapterTypes";

export function evaluateRuntimeAdapterInvocationGuard(
  reports: RuntimeSemanticPlanningReportsBeforeNoopAdapter
): RuntimeAdapterInvocationGuardReport {
  const contract = reports.runtimePilotContractSummary;
  const handoff = reports.runtimePilotHandoffReadiness;
  const boundary = reports.runtimeAdapterBoundarySummary;

  let invocationGuard: RuntimeNoopAdapterInvocationGuard;
  if (
    contract.contractReadiness === "blocked" ||
    handoff.handoffReadiness === "blocked" ||
    boundary.boundaryMode === "handoff_blocked"
  ) {
    invocationGuard = "always_blocked";
  } else if (
    contract.contractReadiness === "contract_metadata_ready" &&
    boundary.boundaryMode === "contract_metadata_only"
  ) {
    invocationGuard = "contract_metadata_only";
  } else {
    invocationGuard = "noop_only";
  }

  const blockedReasons = mergeSortedUniqueKo([
    ...(invocationGuard === "always_blocked" ? ["contract or handoff blocked — invocation always blocked"] : []),
    "actualRuntimeAdapterInvocationEnabled=false",
  ]);

  const rationaleKo =
    invocationGuard === "always_blocked"
      ? "contract/handoff blocked — runtime adapter invocation 항상 차단(no-op skeleton만)."
      : invocationGuard === "contract_metadata_only"
        ? "contract 메타 검증 범위 — adapter는 no-op skeleton·metadata만(실제 호출 없음)."
        : "기본 noop_only — execution·routing·rollback handoff 없음.";

  const recommendations = mergeSortedUniqueKo([
    ...(invocationGuard === "always_blocked"
      ? ["H25: invocation guard always_blocked — H26 전 contract 정렬"]
      : []),
    "H25: actual adapter invocation 금지 유지",
  ]);

  return {
    mode: "runtime_adapter_invocation_guard_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    invocationGuard,
    rationaleKo,
    blockedReasons,
    recommendations,
  };
}
