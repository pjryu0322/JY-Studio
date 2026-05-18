/**
 * H39 — final release governance gate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeFinalReleaseGovernanceGateBlockerReport } from "./runtimeFinalReleaseGovernanceGateTypes";

export function detectRuntimeFinalReleaseGovernanceGateBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate
): RuntimeFinalReleaseGovernanceGateBlockerReport {
  const releaseFinalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;
  const releaseReadiness = reports.runtimeGovernanceReleaseReadinessVerificationReport;
  const releaseAlignment = reports.runtimeGovernanceReleaseReadinessAlignmentReport;
  const releaseViolation = reports.runtimeGovernanceReleaseReadinessViolationReport;
  const releaseBlockers = reports.runtimeGovernanceReleaseBlockerReport;
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (releaseFinalGate.finalGateStatus === "blocked") {
    blockers.push("governance release-readiness final safety gate blocked");
  }
  if (releaseFinalGate.h39EntryReadiness === "blocked") {
    blockers.push("h39 entry readiness blocked");
  }
  if (releaseReadiness.verificationStatus === "failed") {
    blockers.push("governance release-readiness verification failed");
  }
  if (releaseAlignment.alignmentStatus === "failed") {
    blockers.push("governance release-readiness alignment failed");
  }
  if (releaseViolation.actualFlagViolations.length > 0) {
    blockers.push(...releaseViolation.actualFlagViolations.slice(0, 3));
  }
  if (releaseViolation.proofViolations.length > 0) {
    blockers.push(...releaseViolation.proofViolations.slice(0, 3));
  }
  if (releaseBlockers.blockers.length > 0) {
    blockers.push(...releaseBlockers.blockers.slice(0, 2));
  }
  if (governanceFinalGate.finalGateStatus === "blocked") {
    blockers.push("execution governance boundary final safety gate blocked");
  }
  if (shellFinalGate.finalGateStatus === "blocked") {
    blockers.push("execution boundary shell final safety gate blocked");
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
      ? ["H39: final release governance gate blocker — release-readiness·approval 정렬(enforcement 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_final_release_governance_gate_blocker_report",
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
    actualExecutionBlockingEnabled: false,
    actualMergeBlockingEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
