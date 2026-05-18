/**
 * H27 — pilot activation candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotActivation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotActivationBlockerReport } from "./runtimePilotActivationTypes";

export function detectRuntimePilotActivationBlockers(
  reports: RuntimeSemanticPlanningReportsBeforePilotActivation
): RuntimePilotActivationBlockerReport {
  const pf = reports.runtimeAdapterSandboxPreflightSummary;
  const env = reports.runtimeAdapterSandboxEnvelopeVerificationReport;
  const bv = reports.runtimeAdapterSandboxBoundaryViolationReport;
  const sb = reports.runtimeAdapterSandboxBlockerReport;
  const noopPf = reports.runtimeNoopAdapterPreflightSummary;
  const contract = reports.runtimePilotContractVerificationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const blockers: string[] = [];

  if (pf.preflightReadiness === "blocked") {
    blockers.push("sandbox preflight blocked");
  }
  if (env.verificationStatus === "failed") {
    blockers.push("sandbox envelope verification failed");
  }
  if (bv.actualFlagViolations.length > 0) {
    blockers.push(...bv.actualFlagViolations.slice(0, 3));
  }
  if (sb.blockers.length > 0) {
    blockers.push(...sb.blockers.slice(0, 3));
  }
  if (noopPf.preflightReadiness === "blocked") {
    blockers.push("noop adapter preflight blocked");
  }
  if (contract.verificationStatus === "failed") {
    blockers.push("pilot contract verification failed");
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
      ? ["H27: activation candidate blocker — sandbox·approval·control 정렬 후 재평가(activation 없음)"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_activation_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
