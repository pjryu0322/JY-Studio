/**
 * H35 — release-gate final preflight planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeReleaseGateExecutionReadinessBoundary } from "./buildRuntimeReleaseGateExecutionReadinessBoundary";
import { buildRuntimeReleaseGateInputEnvelope } from "./buildRuntimeReleaseGateInputEnvelope";
import { buildRuntimeReleaseGateNoExecutionProof } from "./buildRuntimeReleaseGateNoExecutionProof";
import { buildRuntimeReleaseGateOperationForbiddenProof } from "./buildRuntimeReleaseGateOperationForbiddenProof";
import { buildRuntimeReleaseGateOutputEnvelope } from "./buildRuntimeReleaseGateOutputEnvelope";
import { buildRuntimeReleaseGatePreflightChecklist } from "./buildRuntimeReleaseGatePreflightChecklist";
import { buildRuntimeReleaseGatePreflightSummary } from "./buildRuntimeReleaseGatePreflightSummary";
import { detectRuntimeReleaseGatePreflightBlockers } from "./detectRuntimeReleaseGatePreflightBlockers";
import type { RuntimeReleaseGatePreflightPlanningReports } from "./runtimeReleaseGatePreflightTypes";

export type { RuntimeReleaseGatePreflightPlanningReports } from "./runtimeReleaseGatePreflightTypes";

function mergePreflightLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeReleaseGatePreflightPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight
): RuntimeReleaseGatePreflightPlanningReports {
  const runtimeReleaseGatePreflightBlockerReport = detectRuntimeReleaseGatePreflightBlockers(reports);
  const runtimeReleaseGateExecutionReadinessBoundary = buildRuntimeReleaseGateExecutionReadinessBoundary();
  const runtimeReleaseGateInputEnvelope = buildRuntimeReleaseGateInputEnvelope(reports);
  const runtimeReleaseGateNoExecutionProof = buildRuntimeReleaseGateNoExecutionProof();
  const runtimeReleaseGateOperationForbiddenProof = buildRuntimeReleaseGateOperationForbiddenProof();

  const runtimeReleaseGatePreflightSummary = buildRuntimeReleaseGatePreflightSummary({
    reports,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
  });

  const runtimeReleaseGateOutputEnvelope = buildRuntimeReleaseGateOutputEnvelope({
    summary: runtimeReleaseGatePreflightSummary,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
  });

  const runtimeReleaseGatePreflightChecklist = buildRuntimeReleaseGatePreflightChecklist({
    reports,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
  });

  const runtimeReleaseGatePreflightSummaryFinal = {
    ...runtimeReleaseGatePreflightSummary,
    recommendations: mergePreflightLayerRecommendations([
      runtimeReleaseGatePreflightSummary,
      runtimeReleaseGateExecutionReadinessBoundary,
      runtimeReleaseGateInputEnvelope,
      runtimeReleaseGateOutputEnvelope,
      runtimeReleaseGateNoExecutionProof,
      runtimeReleaseGateOperationForbiddenProof,
      runtimeReleaseGatePreflightChecklist,
    ]),
  };

  return {
    runtimeReleaseGatePreflightSummary: runtimeReleaseGatePreflightSummaryFinal,
    runtimeReleaseGateExecutionReadinessBoundary,
    runtimeReleaseGateInputEnvelope,
    runtimeReleaseGateOutputEnvelope,
    runtimeReleaseGateNoExecutionProof,
    runtimeReleaseGateOperationForbiddenProof,
    runtimeReleaseGatePreflightBlockerReport,
    runtimeReleaseGatePreflightChecklist,
  };
}
