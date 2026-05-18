/**
 * H35 — release-gate final preflight **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeReleaseGatePreflightBlockerReport } from "./runtimeReleaseGatePreflightTypes";

export function detectRuntimeReleaseGatePreflightBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight
): RuntimeReleaseGatePreflightBlockerReport {
  const finalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellReleaseGateReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellReleaseGateAlignmentReport;
  const boundary = reports.runtimeNoopShellReleaseGateBoundaryViolationReport;
  const releaseBlockers = reports.runtimeNoopShellReleaseGateBlockerReport;
  const releaseSummary = reports.runtimeNoopShellReleaseGateSummary;
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (finalGate.finalGateStatus === "blocked") {
    blockers.push("release-gate final safety gate blocked");
  }
  if (finalGate.h35EntryReadiness === "blocked") {
    blockers.push("h35 entry readiness blocked");
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("release-gate readiness verification failed");
  }
  if (alignment.alignmentStatus === "failed") {
    blockers.push("release-gate alignment failed");
  }
  if (boundary.actualFlagViolations.length > 0) {
    blockers.push(...boundary.actualFlagViolations.slice(0, 3));
  }
  if (releaseBlockers.blockers.length > 0) {
    blockers.push(...releaseBlockers.blockers.slice(0, 2));
  }
  if (releaseSummary.releaseGateBlockers.length > 0) {
    blockers.push(...releaseSummary.releaseGateBlockers.slice(0, 2));
  }
  if (hardeningGate.finalGateStatus === "blocked") {
    blockers.push("hardening final safety gate blocked");
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
      ? ["H35: release-gate preflight blocker — release-gate·hardening·approval 정렬(release enforcement 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_release_gate_preflight_blocker_report",
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
