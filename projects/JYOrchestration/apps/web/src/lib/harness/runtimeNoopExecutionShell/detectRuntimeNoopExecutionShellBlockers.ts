/**
 * H31 — no-op execution shell candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopExecutionShellBlockerReport } from "./runtimeNoopExecutionShellTypes";

export function detectRuntimeNoopExecutionShellBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShell
): RuntimeNoopExecutionShellBlockerReport {
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const harnessVerification = reports.runtimeRunnerNoopHarnessReadinessVerificationReport;
  const harnessAlignment = reports.runtimeRunnerNoopHarnessAlignmentReport;
  const harnessBoundary = reports.runtimeRunnerNoopHarnessBoundaryViolationReport;
  const harnessPreflight = reports.runtimeRunnerNoopHarnessPreflightSummary;
  const invocationGate = reports.runtimeRunnerInvocationFinalSafetyGate;
  const skeletonPf = reports.runtimePilotSkeletonPreflightSummary;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (harnessGate.finalGateStatus === "blocked") {
    blockers.push("runner no-op harness final safety gate blocked");
  }
  if (harnessGate.h31EntryReadiness === "blocked") {
    blockers.push("h31 entry readiness blocked");
  }
  if (harnessVerification.verificationStatus === "failed") {
    blockers.push("harness readiness verification failed");
  }
  if (harnessAlignment.alignmentStatus === "failed") {
    blockers.push("harness alignment report failed");
  }
  if (harnessBoundary.actualFlagViolations.length > 0) {
    blockers.push(...harnessBoundary.actualFlagViolations.slice(0, 3));
  }
  if (harnessPreflight.preflightReadiness === "blocked") {
    blockers.push("noop harness preflight blocked");
  }
  if (invocationGate.finalGateStatus === "blocked") {
    blockers.push("runner invocation final safety gate blocked");
  }
  if (skeletonPf.preflightReadiness === "blocked") {
    blockers.push("pilot skeleton preflight blocked");
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
      ? ["H31: execution shell blocker — harness·invocation·approval 정렬 후 재평가(execution 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_noop_execution_shell_blocker_report",
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
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
