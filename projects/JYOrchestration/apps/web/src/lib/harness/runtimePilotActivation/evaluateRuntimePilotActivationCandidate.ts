/**
 * H27 — sandbox preflight 기반 activation **candidate status** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotActivation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimePilotActivationBlockerReport,
  RuntimePilotActivationCandidateStatus,
} from "./runtimePilotActivationTypes";

export function evaluateRuntimePilotActivationCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotActivation;
  readonly blockerReport: RuntimePilotActivationBlockerReport;
}): RuntimePilotActivationCandidateStatus {
  const { reports, blockerReport } = input;
  const pf = reports.runtimeAdapterSandboxPreflightSummary;
  const env = reports.runtimeAdapterSandboxEnvelopeVerificationReport;
  const bv = reports.runtimeAdapterSandboxBoundaryViolationReport;
  const sb = reports.runtimeAdapterSandboxBlockerReport;

  if (blockerReport.blockers.length > 0) {
    return "blocked";
  }
  if (pf.preflightReadiness === "blocked") {
    return "blocked";
  }
  if (env.verificationStatus === "failed") {
    return "blocked";
  }
  if (bv.actualFlagViolations.length > 0) {
    return "blocked";
  }
  if (sb.blockers.length > 0) {
    return "blocked";
  }

  if (pf.preflightReadiness === "watch" || env.verificationStatus === "partial") {
    return "watch";
  }

  if (
    pf.preflightReadiness === "ready_metadata" &&
    env.verificationStatus === "verified_metadata" &&
    bv.actualFlagViolations.length === 0 &&
    sb.blockers.length === 0
  ) {
    return "activation_metadata_candidate";
  }

  return "not_candidate";
}
