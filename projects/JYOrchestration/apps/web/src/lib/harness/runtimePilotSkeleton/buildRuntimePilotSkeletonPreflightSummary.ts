/**
 * H28.5 — pilot skeleton **preflight readiness**(read-only; H29 전 gate, runner 실행 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimePilotRunnerBoundaryViolationReport,
  RuntimePilotRunnerContractVerificationReport,
  RuntimePilotRunnerNoExecutionResultMetadata,
  RuntimePilotSkeletonBlockerReport,
  RuntimePilotSkeletonPreflightReadiness,
  RuntimePilotSkeletonPreflightSummary,
  RuntimePilotSkeletonSummary,
} from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotSkeletonPreflightSummary(input: {
  readonly summary: RuntimePilotSkeletonSummary;
  readonly contractVerification: RuntimePilotRunnerContractVerificationReport;
  readonly boundaryViolation: RuntimePilotRunnerBoundaryViolationReport;
  readonly blockerReport: RuntimePilotSkeletonBlockerReport;
  readonly noExecution: RuntimePilotRunnerNoExecutionResultMetadata;
}): RuntimePilotSkeletonPreflightSummary {
  const { summary, contractVerification, boundaryViolation, blockerReport, noExecution } = input;

  const checklist = mergeSortedUniqueKo([
    "pilot skeleton summary exists",
    "dry-run runner contract exists",
    "runner input envelope exists",
    "runner output envelope exists",
    "runner safety guard exists",
    "contract verification report exists",
    "boundary violation report exists",
    "no-execution result metadata exists",
    `skeletonReadiness:${summary.skeletonReadiness}`,
    `runnerMode:${summary.runnerMode}`,
    `contractVerification:${contractVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `skeletonBlockers:${blockerReport.blockers.length}`,
    `diagnosticOnly:${noExecution.diagnosticOnly}`,
    "overlayWordingStabilized:H28.5",
    "diagnosticBundleIncludesSkeletonPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (contractVerification.verificationStatus === "failed") {
    blockers.push("runner contract verification failed");
  }
  if (summary.skeletonReadiness === "blocked") {
    blockers.push("skeleton readiness blocked");
  }
  if (noExecution.diagnosticOnly !== true) {
    blockers.push("no-execution result metadata not diagnosticOnly");
  }

  let preflightReadiness: RuntimePilotSkeletonPreflightReadiness;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.skeletonReadiness === "blocked" ||
    contractVerification.verificationStatus === "failed" ||
    blockerReport.blockers.length > 0 ||
    noExecution.diagnosticOnly !== true
  ) {
    preflightReadiness = "blocked";
  } else if (
    summary.skeletonReadiness === "watch" ||
    contractVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    preflightReadiness = "watch";
  } else if (
    summary.skeletonReadiness === "skeleton_metadata_ready" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    noExecution.diagnosticOnly === true
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H28.5: skeleton preflight ready_metadata — H29 전 gate 통과(runner 실행 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H28.5: skeleton preflight watch — contract·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H28.5: skeleton preflight blocked — violation·contract 정렬 후 재평가"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H28.5: skeleton preflight not_ready — H28 envelope 정렬"] : []),
  ]);

  return {
    mode: "runtime_pilot_skeleton_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    preflightReadiness,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
