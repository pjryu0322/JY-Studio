/**
 * H29 — runner invocation candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeRunnerInvocationBlockerReport } from "./runtimeRunnerInvocationTypes";

export function detectRuntimeRunnerInvocationBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerInvocation
): RuntimeRunnerInvocationBlockerReport {
  const preflight = reports.runtimePilotSkeletonPreflightSummary;
  const contractVerification = reports.runtimePilotRunnerContractVerificationReport;
  const boundary = reports.runtimePilotRunnerBoundaryViolationReport;
  const skeletonBlockers = reports.runtimePilotSkeletonBlockerReport;
  const gate = reports.runtimePilotActivationFinalSafetyGate;
  const sandboxPf = reports.runtimeAdapterSandboxPreflightSummary;
  const noopPf = reports.runtimeNoopAdapterPreflightSummary;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (preflight.preflightReadiness === "blocked") {
    blockers.push("pilot skeleton preflight blocked");
  }
  if (contractVerification.verificationStatus === "failed") {
    blockers.push("runner contract verification failed");
  }
  if (boundary.actualFlagViolations.length > 0) {
    blockers.push(...boundary.actualFlagViolations.slice(0, 3));
  }
  if (skeletonBlockers.blockers.length > 0) {
    blockers.push(...skeletonBlockers.blockers.slice(0, 3));
  }
  if (gate.finalGateStatus === "blocked") {
    blockers.push("pilot activation final safety gate blocked");
  }
  if (sandboxPf.preflightReadiness === "blocked") {
    blockers.push("sandbox preflight blocked");
  }
  if (noopPf.preflightReadiness === "blocked") {
    blockers.push("noop adapter preflight blocked");
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
      ? ["H29: runner invocation blocker — skeleton·contract·approval 정렬 후 재평가(invocation 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_runner_invocation_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
