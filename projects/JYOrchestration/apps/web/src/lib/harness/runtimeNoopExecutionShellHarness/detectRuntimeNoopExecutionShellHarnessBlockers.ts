/**
 * H32 — controlled execution shell harness **blocker** 탐지(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeNoopExecutionShellHarnessBlockerReport } from "./runtimeNoopExecutionShellHarnessTypes";

export function detectRuntimeNoopExecutionShellHarnessBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness
): RuntimeNoopExecutionShellHarnessBlockerReport {
  const shellGate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const shellVerification = reports.runtimeNoopExecutionShellReadinessVerificationReport;
  const shellBoundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const shellBlockers = reports.runtimeNoopExecutionShellBlockerReport;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (shellGate.finalGateStatus === "blocked") {
    blockers.push("execution shell final gate blocked");
  }
  if (shellGate.h32EntryReadiness === "blocked") {
    blockers.push("h32 entry readiness blocked");
  }
  if (shellVerification.verificationStatus === "failed") {
    blockers.push("execution shell readiness verification failed");
  }
  if (shellBoundary.actualFlagViolations.length > 0) {
    blockers.push(...shellBoundary.actualFlagViolations.slice(0, 3));
  }
  if (shellBlockers.blockers.length > 0) {
    blockers.push(...shellBlockers.blockers.slice(0, 3));
  }
  if (harnessGate.finalGateStatus === "blocked") {
    blockers.push("runner no-op harness final gate blocked");
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
      ? ["H32: execution shell harness blocker — shell·harness·approval 정렬 후 재평가(execution 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
