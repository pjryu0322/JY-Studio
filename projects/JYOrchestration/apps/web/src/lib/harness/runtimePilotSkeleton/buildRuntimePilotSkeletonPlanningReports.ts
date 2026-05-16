/**
 * H28 — pilot skeleton planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotSkeleton } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeDryRunRunnerContract } from "./buildRuntimeDryRunRunnerContract";
import { buildRuntimePilotRunnerInputEnvelope } from "./buildRuntimePilotRunnerInputEnvelope";
import { buildRuntimePilotRunnerOutputEnvelope } from "./buildRuntimePilotRunnerOutputEnvelope";
import { buildRuntimePilotRunnerSafetyGuard } from "./buildRuntimePilotRunnerSafetyGuard";
import { buildRuntimePilotSkeletonSummary } from "./buildRuntimePilotSkeletonSummary";
import { detectRuntimePilotSkeletonBlockers } from "./detectRuntimePilotSkeletonBlockers";
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

  const summaryWithRecs = {
    ...runtimePilotSkeletonSummary,
    recommendations: mergeSortedUniqueKo([
      ...runtimeDryRunRunnerContract.recommendations,
      ...runtimePilotRunnerInputEnvelope.recommendations,
      ...runtimePilotRunnerOutputEnvelope.recommendations,
      ...runtimePilotRunnerSafetyGuard.recommendations,
      ...runtimePilotSkeletonBlockerReport.recommendations,
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
  };
}
