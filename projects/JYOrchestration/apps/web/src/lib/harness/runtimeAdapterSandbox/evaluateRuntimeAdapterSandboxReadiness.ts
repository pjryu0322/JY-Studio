/**
 * H26 — H25.5 preflight 기반 **sandbox readiness** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeAdapterSandbox } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeAdapterSandboxReadiness } from "./runtimeAdapterSandboxTypes";
import type { RuntimeAdapterSandboxBlockerReport } from "./runtimeAdapterSandboxTypes";

export function evaluateRuntimeAdapterSandboxReadiness(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeAdapterSandbox;
  readonly blockerReport: RuntimeAdapterSandboxBlockerReport;
}): RuntimeAdapterSandboxReadiness {
  const { reports, blockerReport } = input;
  const pf = reports.runtimeNoopAdapterPreflightSummary;
  const v = reports.runtimePilotContractVerificationReport;
  const guard = reports.runtimeAdapterInvocationGuardReport;
  const violations = reports.runtimeNoopAdapterBoundaryViolationReport;
  const summary = reports.runtimeNoopAdapterSummary;

  if (
    blockerReport.blockers.length > 0 ||
    pf.preflightReadiness === "blocked" ||
    summary.noopAdapterStatus === "blocked" ||
    v.verificationStatus === "failed" ||
    guard.invocationGuard === "always_blocked" ||
    violations.actualFlagViolations.length > 0
  ) {
    return "blocked";
  }

  if (
    pf.preflightReadiness === "watch" ||
    v.verificationStatus === "partial" ||
    violations.wordingRiskFindings.length > 0 ||
    summary.noopAdapterStatus === "watch"
  ) {
    return "watch";
  }

  if (
    pf.preflightReadiness === "ready_metadata" &&
    v.verificationStatus === "verified_noop" &&
    guard.invocationGuard === "contract_metadata_only" &&
    violations.actualFlagViolations.length === 0 &&
    violations.wordingRiskFindings.length === 0
  ) {
    return "sandbox_metadata_ready";
  }

  return "not_ready";
}
