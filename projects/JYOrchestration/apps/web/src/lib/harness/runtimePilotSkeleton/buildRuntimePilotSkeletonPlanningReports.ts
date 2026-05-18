/**
 * H28–H28.5 — pilot skeleton·stabilization planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotSkeleton } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeDryRunRunnerContract } from "./buildRuntimeDryRunRunnerContract";
import { buildRuntimePilotRunnerInputEnvelope } from "./buildRuntimePilotRunnerInputEnvelope";
import { buildRuntimePilotRunnerNoExecutionResultMetadata } from "./buildRuntimePilotRunnerNoExecutionResultMetadata";
import { buildRuntimePilotRunnerOutputEnvelope } from "./buildRuntimePilotRunnerOutputEnvelope";
import { buildRuntimePilotRunnerSafetyGuard } from "./buildRuntimePilotRunnerSafetyGuard";
import { buildRuntimePilotSkeletonPreflightSummary } from "./buildRuntimePilotSkeletonPreflightSummary";
import { buildRuntimePilotSkeletonSummary } from "./buildRuntimePilotSkeletonSummary";
import { detectRuntimePilotRunnerBoundaryViolations } from "./detectRuntimePilotRunnerBoundaryViolations";
import { detectRuntimePilotSkeletonBlockers } from "./detectRuntimePilotSkeletonBlockers";
import { verifyRuntimePilotRunnerContract } from "./verifyRuntimePilotRunnerContract";
import type { RuntimePilotSkeletonPlanningReports } from "./runtimePilotSkeletonTypes";

export type { RuntimePilotSkeletonPlanningReports } from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotSkeletonPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotSkeleton
): RuntimePilotSkeletonPlanningReports {
  const runtimePilotSkeletonBlockerReport = detectRuntimePilotSkeletonBlockers(reports);

  const runtimePilotSkeletonSummary = buildRuntimePilotSkeletonSummary({
    reports,
    blockerReport: runtimePilotSkeletonBlockerReport,
  });

  const runtimeDryRunRunnerContract = buildRuntimeDryRunRunnerContract({
    skeletonReadiness: runtimePilotSkeletonSummary.skeletonReadiness,
  });
  const runtimePilotRunnerInputEnvelope = buildRuntimePilotRunnerInputEnvelope(reports);
  const runtimePilotRunnerOutputEnvelope = buildRuntimePilotRunnerOutputEnvelope({
    blockerReport: runtimePilotSkeletonBlockerReport,
  });
  const runtimePilotRunnerSafetyGuard = buildRuntimePilotRunnerSafetyGuard();
  const runtimePilotRunnerNoExecutionResultMetadata = buildRuntimePilotRunnerNoExecutionResultMetadata();

  const runtimePilotRunnerContractVerificationReport = verifyRuntimePilotRunnerContract({
    summary: runtimePilotSkeletonSummary,
    contract: runtimeDryRunRunnerContract,
    inputEnvelope: runtimePilotRunnerInputEnvelope,
    outputEnvelope: runtimePilotRunnerOutputEnvelope,
    safetyGuard: runtimePilotRunnerSafetyGuard,
  });

  const runtimePilotRunnerBoundaryViolationReport = detectRuntimePilotRunnerBoundaryViolations({
    summary: runtimePilotSkeletonSummary,
    contract: runtimeDryRunRunnerContract,
    inputEnvelope: runtimePilotRunnerInputEnvelope,
    outputEnvelope: runtimePilotRunnerOutputEnvelope,
    safetyGuard: runtimePilotRunnerSafetyGuard,
    noExecution: runtimePilotRunnerNoExecutionResultMetadata,
  });

  const runtimePilotSkeletonPreflightSummary = buildRuntimePilotSkeletonPreflightSummary({
    summary: runtimePilotSkeletonSummary,
    contractVerification: runtimePilotRunnerContractVerificationReport,
    boundaryViolation: runtimePilotRunnerBoundaryViolationReport,
    blockerReport: runtimePilotSkeletonBlockerReport,
    noExecution: runtimePilotRunnerNoExecutionResultMetadata,
  });

  const summaryWithRecs = {
    ...runtimePilotSkeletonSummary,
    recommendations: mergeSortedUniqueKo([
      ...runtimeDryRunRunnerContract.recommendations,
      ...runtimePilotRunnerInputEnvelope.recommendations,
      ...runtimePilotRunnerOutputEnvelope.recommendations,
      ...runtimePilotRunnerSafetyGuard.recommendations,
      ...runtimePilotSkeletonBlockerReport.recommendations,
      ...runtimePilotRunnerContractVerificationReport.recommendations,
      ...runtimePilotRunnerBoundaryViolationReport.recommendations,
      ...runtimePilotRunnerNoExecutionResultMetadata.recommendations,
      ...runtimePilotSkeletonPreflightSummary.recommendations,
    ]),
    skeletonBlockers: mergeSortedUniqueKo([
      ...runtimePilotSkeletonSummary.skeletonBlockers,
      ...runtimePilotSkeletonBlockerReport.blockers,
    ]),
  };

  return {
    runtimePilotSkeletonSummary: summaryWithRecs,
    runtimeDryRunRunnerContract,
    runtimePilotRunnerInputEnvelope,
    runtimePilotRunnerOutputEnvelope,
    runtimePilotRunnerSafetyGuard,
    runtimePilotSkeletonBlockerReport,
    runtimePilotRunnerContractVerificationReport,
    runtimePilotRunnerBoundaryViolationReport,
    runtimePilotRunnerNoExecutionResultMetadata,
    runtimePilotSkeletonPreflightSummary,
  };
}
