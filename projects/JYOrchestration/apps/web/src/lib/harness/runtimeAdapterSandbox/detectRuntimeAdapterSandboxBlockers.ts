/**
 * H26 — sandbox readiness **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeAdapterSandbox } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterSandboxBlockerReport } from "./runtimeAdapterSandboxTypes";

export function detectRuntimeAdapterSandboxBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeAdapterSandbox
): RuntimeAdapterSandboxBlockerReport {
  const pf = reports.runtimeNoopAdapterPreflightSummary;
  const v = reports.runtimePilotContractVerificationReport;
  const guard = reports.runtimeAdapterInvocationGuardReport;
  const violations = reports.runtimeNoopAdapterBoundaryViolationReport;
  const handoff = reports.runtimePilotHandoffReadiness;
  const boundary = reports.runtimeAdapterBoundarySummary;

  const blockers: string[] = [];

  if (pf.preflightReadiness === "blocked") {
    blockers.push("noop preflight blocked");
  }
  if (v.verificationStatus === "failed") {
    blockers.push("contract verification failed");
  }
  if (violations.actualFlagViolations.length > 0) {
    blockers.push(...violations.actualFlagViolations.slice(0, 3));
  }
  if (guard.invocationGuard === "always_blocked") {
    blockers.push("adapter invocation guard always_blocked");
  }
  if (handoff.handoffReadiness === "blocked") {
    blockers.push("pilot handoff blocked");
  }
  if (boundary.boundaryMode === "handoff_blocked") {
    blockers.push("adapter boundary handoff_blocked");
  }

  const recommendations = mergeSortedUniqueKo([
    ...(blockers.length > 0
      ? ["H26: sandbox blocker — noop·contract·handoff 정렬 후 readiness 재평가"]
      : []),
  ]);

  return {
    mode: "runtime_adapter_sandbox_blocker_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
