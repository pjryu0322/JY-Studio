/**
 * H28 — pilot skeleton **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotSkeleton } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotSkeletonBlockerReport } from "./runtimePilotSkeletonTypes";

export function detectRuntimePilotSkeletonBlockers(
  reports: RuntimeSemanticPlanningReportsBeforePilotSkeleton
): RuntimePilotSkeletonBlockerReport {
  const gate = reports.runtimePilotActivationFinalSafetyGate;
  const boundary = reports.runtimePilotActivationBoundaryViolationReport;
  const verification = reports.runtimePilotActivationReadinessVerificationReport;
  const activationBlockers = reports.runtimePilotActivationBlockerReport;
  const sandboxPf = reports.runtimeAdapterSandboxPreflightSummary;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const blockers: string[] = [];

  if (gate.finalGateStatus === "blocked" || gate.h28EntryReadiness === "blocked") {
    blockers.push("final safety gate blocked");
  }
  if (boundary.actualFlagViolations.length > 0) {
    blockers.push(...boundary.actualFlagViolations.slice(0, 3));
  }
  if (verification.verificationStatus === "failed") {
    blockers.push("activation readiness verification failed");
  }
  if (activationBlockers.blockers.length > 0) {
    blockers.push(...activationBlockers.blockers.slice(0, 3));
  }
  if (sandboxPf.preflightReadiness === "blocked") {
    blockers.push("sandbox preflight blocked");
  }
  if (approval.approvalReadiness === "blocked") {
    blockers.push("operator approval blocked");
  }
  if (rollback.rollbackReadiness === "blocked") {
    blockers.push("rollback readiness blocked");
  }
  if (audit.auditReadiness === "blocked") {
    blockers.push("audit readiness blocked");
  }

  const recommendations = mergeSortedUniqueKo([
    ...(blockers.length > 0
      ? ["H28: skeleton blocker — activation gate·approval·sandbox 정렬 후 skeleton 재평가(실행 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_skeleton_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
