/**
 * H30 — H29.5 final gate 기반 **no-op harness readiness** 산출(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeRunnerNoopHarnessMode,
  RuntimeRunnerNoopHarnessReadiness,
  RuntimeRunnerNoopHarnessSummary,
} from "./runtimeRunnerNoopHarnessTypes";

function resolveHarnessMode(readiness: RuntimeRunnerNoopHarnessReadiness): RuntimeRunnerNoopHarnessMode {
  switch (readiness) {
    case "noop_harness_metadata_ready":
      return "noop_contract_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}

function harnessRationaleKo(readiness: RuntimeRunnerNoopHarnessReadiness): string {
  switch (readiness) {
    case "noop_harness_metadata_ready":
      return "no-op harness 메타 준비 — invocation contract·envelope 정의 가능(실제 runner invocation 없음).";
    case "watch":
      return "no-op harness 주시 — invocation gate·readiness partial.";
    case "blocked":
      return "no-op harness 차단 — final gate·violation·blocker 정렬 필요.";
    default:
      return "no-op harness 미준비 — H29.5 runner invocation final safety gate 선행.";
  }
}

export function buildRuntimeRunnerNoopHarnessSummary(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness
): RuntimeRunnerNoopHarnessSummary {
  const gate = reports.runtimeRunnerInvocationFinalSafetyGate;
  const invocationBoundary = reports.runtimeRunnerInvocationBoundaryViolationReport;
  const invocationVerification = reports.runtimeRunnerInvocationReadinessVerificationReport;
  const invocationBlockers = reports.runtimeRunnerInvocationBlockerReport;

  const harnessBlockers = mergeSortedUniqueKo([
    ...invocationBlockers.blockers,
    ...gate.blockers,
    ...invocationBoundary.actualFlagViolations.slice(0, 3),
  ]);

  let harnessReadiness: RuntimeRunnerNoopHarnessReadiness;

  if (
    harnessBlockers.length > 0 ||
    gate.finalGateStatus === "blocked" ||
    gate.h30EntryReadiness === "blocked" ||
    invocationBoundary.actualFlagViolations.length > 0 ||
    invocationVerification.verificationStatus === "failed"
  ) {
    harnessReadiness = "blocked";
  } else if (
    gate.finalGateStatus === "watch" ||
    gate.h30EntryReadiness === "watch" ||
    invocationVerification.verificationStatus === "partial" ||
    invocationBoundary.wordingRiskFindings.length > 0
  ) {
    harnessReadiness = "watch";
  } else if (
    gate.finalGateStatus === "ready_metadata" &&
    gate.h30EntryReadiness === "ready_metadata" &&
    invocationBoundary.actualFlagViolations.length === 0 &&
    invocationVerification.verificationStatus === "verified_metadata" &&
    invocationBlockers.blockers.length === 0
  ) {
    harnessReadiness = "noop_harness_metadata_ready";
  } else {
    harnessReadiness = "not_ready";
  }

  const harnessMode = resolveHarnessMode(harnessReadiness);

  const recommendations = mergeSortedUniqueKo([
    ...(harnessReadiness === "noop_harness_metadata_ready"
      ? ["H30: no-op harness metadata_ready — contract verification·preflight 후보(invocation 없음)"]
      : []),
    ...(harnessReadiness === "watch" ? ["H30: no-op harness watch — invocation gate·readiness 재검토"] : []),
    ...(harnessReadiness === "blocked"
      ? ["H30: no-op harness blocked — violation·blocker·verification 정렬"]
      : []),
    ...(harnessReadiness === "not_ready" ? ["H30: no-op harness not_ready — H29.5 final gate 선행"] : []),
  ]);

  return {
    mode: "runtime_runner_noop_harness_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    harnessReadiness,
    harnessMode,
    rationaleKo: harnessRationaleKo(harnessReadiness),
    harnessBlockers,
    recommendations,
  };
}
