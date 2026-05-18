/**
 * H32 — controlled no-op execution shell harness planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopExecutionShellContractBoundary } from "./buildRuntimeNoopExecutionShellContractBoundary";
import { buildRuntimeNoopExecutionShellHarnessInputEnvelope } from "./buildRuntimeNoopExecutionShellHarnessInputEnvelope";
import { buildRuntimeNoopExecutionShellHarnessOutputEnvelope } from "./buildRuntimeNoopExecutionShellHarnessOutputEnvelope";
import { buildRuntimeNoopExecutionShellHarnessPreflightSummary } from "./buildRuntimeNoopExecutionShellHarnessPreflightSummary";
import { buildRuntimeNoopExecutionShellHarnessSafetyGuard } from "./buildRuntimeNoopExecutionShellHarnessSafetyGuard";
import { buildRuntimeNoopExecutionShellHarnessSummary } from "./buildRuntimeNoopExecutionShellHarnessSummary";
import { buildRuntimeNoopExecutionShellNoopResultMetadata } from "./buildRuntimeNoopExecutionShellNoopResultMetadata";
import { detectRuntimeNoopExecutionShellHarnessBlockers } from "./detectRuntimeNoopExecutionShellHarnessBlockers";
import type {
  RuntimeNoopExecutionShellHarnessPlanningReports,
  RuntimeNoopExecutionShellHarnessSummary,
} from "./runtimeNoopExecutionShellHarnessTypes";

export type { RuntimeNoopExecutionShellHarnessPlanningReports } from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellHarnessPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness
): RuntimeNoopExecutionShellHarnessPlanningReports {
  const runtimeNoopExecutionShellHarnessBlockerReport = detectRuntimeNoopExecutionShellHarnessBlockers(reports);
  const runtimeNoopExecutionShellHarnessSummary = buildRuntimeNoopExecutionShellHarnessSummary(
    reports,
    runtimeNoopExecutionShellHarnessBlockerReport
  );
  const runtimeNoopExecutionShellContractBoundary = buildRuntimeNoopExecutionShellContractBoundary();
  const runtimeNoopExecutionShellHarnessInputEnvelope = buildRuntimeNoopExecutionShellHarnessInputEnvelope(reports);
  const runtimeNoopExecutionShellNoopResultMetadata = buildRuntimeNoopExecutionShellNoopResultMetadata();
  const runtimeNoopExecutionShellHarnessSafetyGuard = buildRuntimeNoopExecutionShellHarnessSafetyGuard();
  const runtimeNoopExecutionShellHarnessOutputEnvelope = buildRuntimeNoopExecutionShellHarnessOutputEnvelope({
    summary: runtimeNoopExecutionShellHarnessSummary,
    result: runtimeNoopExecutionShellNoopResultMetadata,
  });
  const runtimeNoopExecutionShellHarnessPreflightSummary = buildRuntimeNoopExecutionShellHarnessPreflightSummary({
    summary: runtimeNoopExecutionShellHarnessSummary,
    contractBoundary: runtimeNoopExecutionShellContractBoundary,
    inputEnvelope: runtimeNoopExecutionShellHarnessInputEnvelope,
    outputEnvelope: runtimeNoopExecutionShellHarnessOutputEnvelope,
    result: runtimeNoopExecutionShellNoopResultMetadata,
    safetyGuard: runtimeNoopExecutionShellHarnessSafetyGuard,
    blockerReport: runtimeNoopExecutionShellHarnessBlockerReport,
  });

  const runtimeNoopExecutionShellHarnessSummaryFinal: RuntimeNoopExecutionShellHarnessSummary = {
    ...runtimeNoopExecutionShellHarnessSummary,
    recommendations: mergeSortedUniqueKo([
      ...runtimeNoopExecutionShellHarnessSummary.recommendations,
      ...runtimeNoopExecutionShellContractBoundary.recommendations,
      ...runtimeNoopExecutionShellHarnessInputEnvelope.recommendations,
      ...runtimeNoopExecutionShellHarnessOutputEnvelope.recommendations,
      ...runtimeNoopExecutionShellNoopResultMetadata.recommendations,
      ...runtimeNoopExecutionShellHarnessSafetyGuard.recommendations,
      ...runtimeNoopExecutionShellHarnessBlockerReport.recommendations,
      ...runtimeNoopExecutionShellHarnessPreflightSummary.recommendations,
    ]),
  };

  return {
    runtimeNoopExecutionShellHarnessSummary: runtimeNoopExecutionShellHarnessSummaryFinal,
    runtimeNoopExecutionShellContractBoundary,
    runtimeNoopExecutionShellHarnessInputEnvelope,
    runtimeNoopExecutionShellHarnessOutputEnvelope,
    runtimeNoopExecutionShellNoopResultMetadata,
    runtimeNoopExecutionShellHarnessSafetyGuard,
    runtimeNoopExecutionShellHarnessBlockerReport,
    runtimeNoopExecutionShellHarnessPreflightSummary,
  };
}
