/**
 * H38 — governance release-readiness planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeExecutionGovernanceForbiddenProof } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import { buildRuntimeGovernanceNoEnforcementProof } from "./buildRuntimeGovernanceNoEnforcementProof";
import { buildRuntimeGovernanceReleaseInputEnvelope } from "./buildRuntimeGovernanceReleaseInputEnvelope";
import { buildRuntimeGovernanceReleaseOutputEnvelope } from "./buildRuntimeGovernanceReleaseOutputEnvelope";
import { buildRuntimeGovernanceReleaseReadinessBoundary } from "./buildRuntimeGovernanceReleaseReadinessBoundary";
import { buildRuntimeGovernanceReleaseReadinessChecklist } from "./buildRuntimeGovernanceReleaseReadinessChecklist";
import { buildRuntimeGovernanceReleaseReadinessSummary } from "./buildRuntimeGovernanceReleaseReadinessSummary";
import { detectRuntimeGovernanceReleaseBlockers } from "./detectRuntimeGovernanceReleaseBlockers";
import type { RuntimeGovernanceReleaseReadinessPlanningReports } from "./runtimeGovernanceReleaseReadinessTypes";

export type { RuntimeGovernanceReleaseReadinessPlanningReports } from "./runtimeGovernanceReleaseReadinessTypes";

function mergeGovernanceReleaseLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeGovernanceReleaseReadinessPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness
): RuntimeGovernanceReleaseReadinessPlanningReports {
  const runtimeGovernanceReleaseBlockerReport = detectRuntimeGovernanceReleaseBlockers(reports);
  const runtimeGovernanceReleaseReadinessBoundary = buildRuntimeGovernanceReleaseReadinessBoundary();
  const runtimeGovernanceReleaseInputEnvelope = buildRuntimeGovernanceReleaseInputEnvelope(reports);
  const runtimeGovernanceNoEnforcementProof = buildRuntimeGovernanceNoEnforcementProof();
  const runtimeExecutionGovernanceForbiddenProof = buildRuntimeExecutionGovernanceForbiddenProof();

  const runtimeGovernanceReleaseReadinessSummary = buildRuntimeGovernanceReleaseReadinessSummary({
    reports,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
  });

  const runtimeGovernanceReleaseOutputEnvelope = buildRuntimeGovernanceReleaseOutputEnvelope({
    summary: runtimeGovernanceReleaseReadinessSummary,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
  });

  const runtimeGovernanceReleaseReadinessChecklist = buildRuntimeGovernanceReleaseReadinessChecklist({
    reports,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
  });

  const runtimeGovernanceReleaseReadinessSummaryFinal = {
    ...runtimeGovernanceReleaseReadinessSummary,
    recommendations: mergeGovernanceReleaseLayerRecommendations([
      runtimeGovernanceReleaseReadinessSummary,
      runtimeGovernanceReleaseReadinessBoundary,
      runtimeGovernanceReleaseInputEnvelope,
      runtimeGovernanceReleaseOutputEnvelope,
      runtimeGovernanceNoEnforcementProof,
      runtimeExecutionGovernanceForbiddenProof,
      runtimeGovernanceReleaseReadinessChecklist,
    ]),
  };

  return {
    runtimeGovernanceReleaseReadinessSummary: runtimeGovernanceReleaseReadinessSummaryFinal,
    runtimeGovernanceReleaseReadinessBoundary,
    runtimeGovernanceReleaseInputEnvelope,
    runtimeGovernanceReleaseOutputEnvelope,
    runtimeGovernanceNoEnforcementProof,
    runtimeExecutionGovernanceForbiddenProof,
    runtimeGovernanceReleaseBlockerReport,
    runtimeGovernanceReleaseReadinessChecklist,
  };
}
