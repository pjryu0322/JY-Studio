/**
 * H36 — execution boundary shell **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeExecutionBoundaryShellBlockerReport } from "./runtimeExecutionBoundaryShellTypes";

export function detectRuntimeExecutionBoundaryShellBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell
): RuntimeExecutionBoundaryShellBlockerReport {
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const readinessVerification = reports.runtimeReleaseGatePreflightReadinessVerificationReport;
  const alignment = reports.runtimeReleaseGatePreflightAlignmentReport;
  const boundaryViolation = reports.runtimeReleaseGatePreflightBoundaryViolationReport;
  const preflightBlockers = reports.runtimeReleaseGatePreflightBlockerReport;
  const releaseGateFinalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (preflightFinalGate.finalGateStatus === "blocked") {
    blockers.push("release-gate preflight final safety gate blocked");
  }
  if (preflightFinalGate.h36EntryReadiness === "blocked") {
    blockers.push("h36 entry readiness blocked");
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("release-gate preflight readiness verification failed");
  }
  if (alignment.alignmentStatus === "failed") {
    blockers.push("release-gate preflight alignment report failed");
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (boundaryViolation.proofViolations.length > 0) {
    blockers.push(...boundaryViolation.proofViolations.slice(0, 3));
  }
  if (preflightBlockers.blockers.length > 0) {
    blockers.push(...preflightBlockers.blockers.slice(0, 3));
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
      ? ["H36: execution boundary shell blocker — preflight final gate·approval 정렬 후 재평가(execution 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_execution_boundary_shell_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
