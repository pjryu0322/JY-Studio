/**
 * H37 — governance boundary **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeExecutionGovernanceBoundaryBlockerReport } from "./runtimeExecutionGovernanceBoundaryTypes";

export function detectRuntimeExecutionGovernanceBoundaryBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary
): RuntimeExecutionGovernanceBoundaryBlockerReport {
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const shellReadiness = reports.runtimeExecutionBoundaryShellReadinessVerificationReport;
  const shellAlignment = reports.runtimeExecutionBoundaryShellAlignmentReport;
  const shellBoundaryViolation = reports.runtimeExecutionBoundaryShellBoundaryViolationReport;
  const shellBlockers = reports.runtimeExecutionBoundaryShellBlockerReport;
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const releaseGateFinalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (shellFinalGate.finalGateStatus === "blocked") {
    blockers.push("execution boundary shell final safety gate blocked");
  }
  if (shellFinalGate.h37EntryReadiness === "blocked") {
    blockers.push("h37 entry readiness blocked");
  }
  if (shellReadiness.verificationStatus === "failed") {
    blockers.push("execution boundary shell readiness verification failed");
  }
  if (shellAlignment.alignmentStatus === "failed") {
    blockers.push("execution boundary shell alignment report failed");
  }
  if (shellBoundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...shellBoundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (shellBlockers.blockers.length > 0) {
    blockers.push(...shellBlockers.blockers.slice(0, 3));
  }
  if (preflightFinalGate.finalGateStatus === "blocked") {
    blockers.push("release-gate preflight final safety gate blocked");
  }
  if (releaseGateFinalGate.finalGateStatus === "blocked") {
    blockers.push("release-gate final safety gate blocked");
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
  if (control.boundaryRisk === "blocked") {
    blockers.push("control boundary blocked");
  }

  const recommendations = mergeSortedUniqueKo([
    ...(blockers.length > 0
      ? ["H37: governance boundary blocker — execution boundary shell final gate·approval 정렬 후 재평가(execution 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_execution_governance_boundary_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
