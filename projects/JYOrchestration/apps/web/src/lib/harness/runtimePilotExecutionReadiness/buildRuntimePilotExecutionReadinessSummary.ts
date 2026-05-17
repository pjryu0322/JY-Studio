/**
 * H44 — pilot execution readiness **summary**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import { resolveRuntimePilotExecutionReadinessMode } from "./resolveRuntimePilotExecutionReadinessMode";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessStatus,
  RuntimePilotExecutionReadinessSummary,
} from "./runtimePilotExecutionReadinessTypes";

export function evaluateRuntimePilotExecutionReadinessStatus(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
}): RuntimePilotExecutionReadinessStatus {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const reviewFinalGate = reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate;
  const reviewVerification = reports.runtimeLimitedPilotReadinessReviewVerificationReport;
  const reviewAlignment = reports.runtimeLimitedPilotReadinessReviewAlignmentReport;
  const reviewViolation = reports.runtimeLimitedPilotReadinessReviewViolationReport;

  const hasReviewViolations =
    reviewViolation.actualFlagViolations.length > 0 ||
    reviewViolation.proofViolations.length > 0 ||
    reviewViolation.forbiddenProofViolations.length > 0;

  if (
    reviewFinalGate.finalGateStatus === "blocked" ||
    reviewFinalGate.h44EntryReadiness === "blocked" ||
    reviewVerification.verificationStatus === "failed" ||
    reviewAlignment.alignmentStatus === "failed" ||
    hasReviewViolations ||
    blockerReport.blockers.length > 0 ||
    !isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof) ||
    !isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof)
  ) {
    return "blocked";
  }

  if (
    reviewFinalGate.finalGateStatus === "watch" ||
    reviewFinalGate.h44EntryReadiness === "watch" ||
    reviewVerification.verificationStatus === "partial" ||
    reviewAlignment.alignmentStatus === "partial" ||
    reviewViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    reviewFinalGate.finalGateStatus === "ready_metadata" &&
    reviewFinalGate.h44EntryReadiness === "ready_metadata" &&
    reviewVerification.verificationStatus === "verified_metadata" &&
    reviewAlignment.alignmentStatus === "aligned_metadata" &&
    !hasReviewViolations &&
    blockerReport.blockers.length === 0 &&
    isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof) &&
    isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof)
  ) {
    return "pilot_execution_readiness_metadata_ready";
  }

  return "not_ready";
}

function readinessRationaleKo(status: RuntimePilotExecutionReadinessStatus): string {
  switch (status) {
    case "pilot_execution_readiness_metadata_ready":
      return "limited pilot readiness review final gate·H44 entry readiness 정렬 — pilot execution readiness boundary 메타(실제 pilot activation·execution 없음).";
    case "watch":
      return "pilot execution readiness 주시 — review partial·wording risk(pilot·execution 금지).";
    case "blocked":
      return "pilot execution readiness 차단 — review final gate·blocker·proof 정렬 필요.";
    default:
      return "pilot execution readiness 미준비 — limited pilot readiness review final safety gate 선행.";
  }
}

export function buildRuntimePilotExecutionReadinessSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
}): RuntimePilotExecutionReadinessSummary {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const readinessStatus = evaluateRuntimePilotExecutionReadinessStatus({
    reports,
    blockerReport,
    noExecutionProof,
    forbiddenProof,
  });
  const readinessMode = resolveRuntimePilotExecutionReadinessMode(readinessStatus);

  return {
    mode: "runtime_pilot_execution_readiness_summary",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    readinessStatus,
    readinessMode,
    rationaleKo: readinessRationaleKo(readinessStatus),
    readinessBlockers: mergeSortedUniqueKo([
      ...blockerReport.blockers,
      ...reports.runtimeLimitedPilotReadinessReviewSummary.reviewBlockers.slice(0, 3),
    ]),
    recommendations: [],
  };
}
