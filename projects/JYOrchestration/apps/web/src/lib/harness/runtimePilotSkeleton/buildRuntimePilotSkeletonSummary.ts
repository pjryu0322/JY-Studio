/**
 * H28 — H27.5 final gate 기반 **skeleton readiness** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotSkeleton } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimePilotRunnerMode,
  RuntimePilotSkeletonBlockerReport,
  RuntimePilotSkeletonReadiness,
  RuntimePilotSkeletonSummary,
} from "./runtimePilotSkeletonTypes";

function resolveRunnerMode(readiness: RuntimePilotSkeletonReadiness): RuntimePilotRunnerMode {
  switch (readiness) {
    case "skeleton_metadata_ready":
      return "dry_run_contract_only";
    case "blocked":
      return "blocked";
    default:
      return "disabled";
  }
}

function skeletonRationaleKo(readiness: RuntimePilotSkeletonReadiness): string {
  switch (readiness) {
    case "skeleton_metadata_ready":
      return "pilot skeleton 메타 준비 — dry-run runner contract 정의 가능(실제 runner 실행 없음).";
    case "watch":
      return "pilot skeleton 주시 — activation gate·readiness partial.";
    case "blocked":
      return "pilot skeleton 차단 — final gate·violation·blocker 정렬 필요.";
    default:
      return "pilot skeleton 미준비 — H27.5 final safety gate 선행.";
  }
}

export function buildRuntimePilotSkeletonSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotSkeleton;
  readonly blockerReport: RuntimePilotSkeletonBlockerReport;
}): RuntimePilotSkeletonSummary {
  const { reports, blockerReport } = input;
  const gate = reports.runtimePilotActivationFinalSafetyGate;
  const boundary = reports.runtimePilotActivationBoundaryViolationReport;
  const verification = reports.runtimePilotActivationReadinessVerificationReport;

  let skeletonReadiness: RuntimePilotSkeletonReadiness;

  if (
    blockerReport.blockers.length > 0 ||
    gate.finalGateStatus === "blocked" ||
    gate.h28EntryReadiness === "blocked" ||
    boundary.actualFlagViolations.length > 0 ||
    verification.verificationStatus === "failed"
  ) {
    skeletonReadiness = "blocked";
  } else if (
    gate.finalGateStatus === "watch" ||
    gate.h28EntryReadiness === "watch" ||
    verification.verificationStatus === "partial" ||
    boundary.wordingRiskFindings.length > 0
  ) {
    skeletonReadiness = "watch";
  } else if (
    gate.finalGateStatus === "ready_metadata" &&
    gate.h28EntryReadiness === "ready_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    verification.verificationStatus === "verified_metadata" &&
    blockerReport.blockers.length === 0
  ) {
    skeletonReadiness = "skeleton_metadata_ready";
  } else {
    skeletonReadiness = "not_ready";
  }

  const runnerMode = resolveRunnerMode(skeletonReadiness);

  return {
    mode: "runtime_pilot_skeleton_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    skeletonReadiness,
    runnerMode,
    rationaleKo: skeletonRationaleKo(skeletonReadiness),
    skeletonBlockers: [...blockerReport.blockers],
    recommendations: [],
  };
}
