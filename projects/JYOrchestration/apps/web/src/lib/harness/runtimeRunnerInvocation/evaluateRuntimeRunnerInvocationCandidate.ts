/**
 * H29 — skeleton preflight 기반 runner invocation **candidate status** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeRunnerInvocationBlockerReport,
  RuntimeRunnerInvocationCandidateStatus,
} from "./runtimeRunnerInvocationTypes";

export function evaluateRuntimeRunnerInvocationCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeRunnerInvocation;
  readonly blockerReport: RuntimeRunnerInvocationBlockerReport;
}): RuntimeRunnerInvocationCandidateStatus {
  const { reports, blockerReport } = input;
  const preflight = reports.runtimePilotSkeletonPreflightSummary;
  const contractVerification = reports.runtimePilotRunnerContractVerificationReport;
  const boundary = reports.runtimePilotRunnerBoundaryViolationReport;
  const skeletonBlockers = reports.runtimePilotSkeletonBlockerReport;
  const noExecution = reports.runtimePilotRunnerNoExecutionResultMetadata;

  if (
    blockerReport.blockers.length > 0 ||
    preflight.preflightReadiness === "blocked" ||
    contractVerification.verificationStatus === "failed" ||
    boundary.actualFlagViolations.length > 0 ||
    skeletonBlockers.blockers.length > 0
  ) {
    return "blocked";
  }

  if (
    preflight.preflightReadiness === "watch" ||
    contractVerification.verificationStatus === "partial" ||
    boundary.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    preflight.preflightReadiness === "ready_metadata" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    skeletonBlockers.blockers.length === 0 &&
    noExecution.diagnosticOnly === true
  ) {
    return "invocation_metadata_candidate";
  }

  return "not_candidate";
}
