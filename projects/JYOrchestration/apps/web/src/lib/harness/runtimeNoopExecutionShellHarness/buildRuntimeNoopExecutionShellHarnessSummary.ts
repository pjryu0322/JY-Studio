/**
 * H32 — H31 execution shell final gate 기반 **shell harness readiness** 산출(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopExecutionShellHarnessMode,
  RuntimeNoopExecutionShellHarnessReadiness,
  RuntimeNoopExecutionShellHarnessSummary,
} from "./runtimeNoopExecutionShellHarnessTypes";
import type { RuntimeNoopExecutionShellHarnessBlockerReport } from "./runtimeNoopExecutionShellHarnessTypes";

function resolveHarnessMode(readiness: RuntimeNoopExecutionShellHarnessReadiness): RuntimeNoopExecutionShellHarnessMode {
  switch (readiness) {
    case "shell_harness_metadata_ready":
      return "shell_contract_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}

function harnessRationaleKo(readiness: RuntimeNoopExecutionShellHarnessReadiness): string {
  switch (readiness) {
    case "shell_harness_metadata_ready":
      return "controlled no-op execution shell harness 메타 준비 — shell contract boundary·envelope 정의 가능(실제 shell execution 없음).";
    case "watch":
      return "execution shell harness 주시 — final gate·readiness partial.";
    case "blocked":
      return "execution shell harness 차단 — violation·blocker 정렬 필요.";
    default:
      return "execution shell harness 미준비 — H31.5 execution shell final safety gate 선행.";
  }
}

export function buildRuntimeNoopExecutionShellHarnessSummary(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness,
  blockerReport: RuntimeNoopExecutionShellHarnessBlockerReport
): RuntimeNoopExecutionShellHarnessSummary {
  const gate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const shellSummary = reports.runtimeNoopExecutionShellSummary;
  const verification = reports.runtimeNoopExecutionShellReadinessVerificationReport;
  const boundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const shellBlockers = reports.runtimeNoopExecutionShellBlockerReport;

  const harnessBlockers = mergeSortedUniqueKo([
    ...blockerReport.blockers,
    ...shellBlockers.blockers,
    ...shellSummary.shellBlockers,
    ...gate.blockers,
    ...boundary.actualFlagViolations.slice(0, 3),
  ]);

  let harnessReadiness: RuntimeNoopExecutionShellHarnessReadiness;

  if (
    harnessBlockers.length > 0 ||
    gate.finalGateStatus === "blocked" ||
    gate.h32EntryReadiness === "blocked" ||
    boundary.actualFlagViolations.length > 0 ||
    verification.verificationStatus === "failed" ||
    shellSummary.candidateStatus === "blocked"
  ) {
    harnessReadiness = "blocked";
  } else if (
    gate.finalGateStatus === "watch" ||
    gate.h32EntryReadiness === "watch" ||
    verification.verificationStatus === "partial" ||
    shellSummary.candidateStatus === "watch"
  ) {
    harnessReadiness = "watch";
  } else if (
    gate.finalGateStatus === "ready_metadata" &&
    gate.h32EntryReadiness === "ready_metadata" &&
    verification.verificationStatus === "verified_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    shellBlockers.blockers.length === 0 &&
    shellSummary.shellBlockers.length === 0
  ) {
    harnessReadiness = "shell_harness_metadata_ready";
  } else {
    harnessReadiness = "not_ready";
  }

  const harnessMode = resolveHarnessMode(harnessReadiness);

  const recommendations = mergeSortedUniqueKo([
    ...(harnessReadiness === "shell_harness_metadata_ready"
      ? ["H32: execution shell harness metadata_ready — contract boundary·preflight 후보(shell execution 없음)"]
      : []),
    ...(harnessReadiness === "watch" ? ["H32: execution shell harness watch — shell gate·readiness 재검토"] : []),
    ...(harnessReadiness === "blocked"
      ? ["H32: execution shell harness blocked — violation·blocker 정렬"]
      : []),
    ...(harnessReadiness === "not_ready" ? ["H32: execution shell harness not_ready — H31.5 final gate 선행"] : []),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
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
