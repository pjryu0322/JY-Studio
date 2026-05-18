/**
 * H34 — release-gate candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeNoopShellReleaseGateBlockerReport } from "./runtimeNoopShellReleaseGateTypes";

export function detectRuntimeNoopShellReleaseGateBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate
): RuntimeNoopShellReleaseGateBlockerReport {
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellHardeningReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellHardeningAlignmentReport;
  const boundary = reports.runtimeNoopShellHardeningBoundaryViolationReport;
  const hardeningPreflight = reports.runtimeNoopShellHardeningPreflightSummary;
  const harnessPreflight = reports.runtimeNoopExecutionShellHarnessPreflightSummary;
  const shellGate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (hardeningGate.finalGateStatus === "blocked") {
    blockers.push("shell hardening final safety gate blocked");
  }
  if (hardeningGate.h34EntryReadiness === "blocked") {
    blockers.push("h34 entry readiness blocked");
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("shell hardening readiness verification failed");
  }
  if (alignment.alignmentStatus === "failed") {
    blockers.push("shell hardening alignment report failed");
  }
  if (boundary.actualFlagViolations.length > 0) {
    blockers.push(...boundary.actualFlagViolations.slice(0, 3));
  }
  if (hardeningPreflight.preflightReadiness === "blocked") {
    blockers.push("shell hardening preflight blocked");
  }
  if (harnessPreflight.preflightReadiness === "blocked") {
    blockers.push("execution shell harness preflight blocked");
  }
  if (shellGate.finalGateStatus === "blocked") {
    blockers.push("execution shell final safety gate blocked");
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
      ? ["H34: release-gate blocker — hardening·harness·approval 정렬 후 재평가(release enforcement 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
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
