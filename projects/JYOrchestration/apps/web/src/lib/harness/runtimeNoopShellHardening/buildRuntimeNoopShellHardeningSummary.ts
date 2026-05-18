/**
 * H33 — H31.5 shell final gate 기반 **shell hardening readiness** 산출(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellHardening } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopShellHardeningMode,
  RuntimeNoopShellHardeningReadiness,
  RuntimeNoopShellHardeningSummary,
} from "./runtimeNoopShellHardeningTypes";

function resolveHardeningMode(readiness: RuntimeNoopShellHardeningReadiness): RuntimeNoopShellHardeningMode {
  switch (readiness) {
    case "hardening_metadata_ready":
      return "contract_verification_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}

function hardeningRationaleKo(readiness: RuntimeNoopShellHardeningReadiness): string {
  switch (readiness) {
    case "hardening_metadata_ready":
      return "no-op shell hardening 메타 준비 — shell contract·envelope 정의 가능(실제 shell execution 없음).";
    case "watch":
      return "shell hardening 주시 — final gate·readiness partial·wording risk.";
    case "blocked":
      return "shell hardening 차단 — violation·blocker·verification 정렬 필요.";
    default:
      return "shell hardening 미준비 — H31.5 execution shell final safety gate 선행.";
  }
}

export function buildRuntimeNoopShellHardeningSummary(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellHardening
): RuntimeNoopShellHardeningSummary {
  const gate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const shellSummary = reports.runtimeNoopExecutionShellSummary;
  const verification = reports.runtimeNoopExecutionShellReadinessVerificationReport;
  const boundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const shellBlockers = reports.runtimeNoopExecutionShellBlockerReport;

  const hardeningBlockers = mergeSortedUniqueKo([
    ...shellBlockers.blockers,
    ...shellSummary.shellBlockers,
    ...gate.blockers,
    ...boundary.actualFlagViolations.slice(0, 3),
  ]);

  let hardeningReadiness: RuntimeNoopShellHardeningReadiness;

  if (
    hardeningBlockers.length > 0 ||
    gate.finalGateStatus === "blocked" ||
    gate.h32EntryReadiness === "blocked" ||
    boundary.actualFlagViolations.length > 0 ||
    verification.verificationStatus === "failed" ||
    shellSummary.candidateStatus === "blocked"
  ) {
    hardeningReadiness = "blocked";
  } else if (
    gate.finalGateStatus === "watch" ||
    gate.h32EntryReadiness === "watch" ||
    verification.verificationStatus === "partial" ||
    boundary.wordingRiskFindings.length > 0 ||
    shellSummary.candidateStatus === "watch"
  ) {
    hardeningReadiness = "watch";
  } else if (
    gate.finalGateStatus === "ready_metadata" &&
    gate.h32EntryReadiness === "ready_metadata" &&
    verification.verificationStatus === "verified_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    shellBlockers.blockers.length === 0 &&
    shellSummary.shellBlockers.length === 0
  ) {
    hardeningReadiness = "hardening_metadata_ready";
  } else {
    hardeningReadiness = "not_ready";
  }

  const hardeningMode = resolveHardeningMode(hardeningReadiness);

  const recommendations = mergeSortedUniqueKo([
    ...(hardeningReadiness === "hardening_metadata_ready"
      ? ["H33: shell hardening metadata_ready — contract verification·preflight 후보(shell execution 없음)"]
      : []),
    ...(hardeningReadiness === "watch" ? ["H33: shell hardening watch — shell gate·readiness 재검토"] : []),
    ...(hardeningReadiness === "blocked"
      ? ["H33: shell hardening blocked — violation·blocker·verification 정렬"]
      : []),
    ...(hardeningReadiness === "not_ready" ? ["H33: shell hardening not_ready — H31.5 final gate 선행"] : []),
  ]);

  return {
    mode: "runtime_noop_shell_hardening_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    hardeningReadiness,
    hardeningMode,
    rationaleKo: hardeningRationaleKo(hardeningReadiness),
    hardeningBlockers,
    recommendations,
  };
}
