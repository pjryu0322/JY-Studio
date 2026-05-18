/**
 * H38 — governance release-readiness **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeGovernanceReleaseBlockerReport } from "./runtimeGovernanceReleaseReadinessTypes";

export function detectRuntimeGovernanceReleaseBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness
): RuntimeGovernanceReleaseBlockerReport {
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const governanceReadiness = reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport;
  const governanceAlignment = reports.runtimeExecutionGovernanceBoundaryAlignmentReport;
  const governanceBoundaryViolation = reports.runtimeExecutionGovernanceBoundaryViolationReport;
  const governanceBlockers = reports.runtimeExecutionGovernanceBoundaryBlockerReport;
  const governanceSummary = reports.runtimeExecutionGovernanceBoundarySummary;
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (governanceFinalGate.finalGateStatus === "blocked") {
    blockers.push("governance boundary final safety gate blocked");
  }
  if (governanceFinalGate.h38EntryReadiness === "blocked") {
    blockers.push("h38 entry readiness blocked");
  }
  if (governanceReadiness.verificationStatus === "failed") {
    blockers.push("governance boundary readiness verification failed");
  }
  if (governanceAlignment.alignmentStatus === "failed") {
    blockers.push("governance boundary alignment failed");
  }
  if (governanceBoundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...governanceBoundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (governanceBlockers.blockers.length > 0) {
    blockers.push(...governanceBlockers.blockers.slice(0, 2));
  }
  if (governanceSummary.governanceBlockers.length > 0) {
    blockers.push(...governanceSummary.governanceBlockers.slice(0, 2));
  }
  if (shellFinalGate.finalGateStatus === "blocked") {
    blockers.push("execution boundary shell final safety gate blocked");
  }
  if (preflightFinalGate.finalGateStatus === "blocked") {
    blockers.push("release-gate preflight final safety gate blocked");
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
      ? ["H38: governance release-readiness blocker — governance boundary·approval 정렬(enforcement 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_governance_release_blocker_report",
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
