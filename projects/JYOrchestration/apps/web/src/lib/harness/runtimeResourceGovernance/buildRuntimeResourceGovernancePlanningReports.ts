/**
 * H21 — resource governance planning reports **일괄 산출**(resourceReports 재계산 없음).
 */

import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type { RuntimeSemanticPlanningReportsBeforeGovernance } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeResourcePolicyFindings } from "./buildRuntimeResourcePolicyFindings";
import { evaluateRuntimeResourceControlBoundary } from "./evaluateRuntimeResourceControlBoundary";
import { evaluateRuntimeResourceGovernance } from "./evaluateRuntimeResourceGovernance";
import type { RuntimeResourceGovernancePlanningReports } from "./runtimeResourceGovernanceTypes";

export type { RuntimeResourceGovernancePlanningReports } from "./runtimeResourceGovernanceTypes";

export function buildRuntimeResourceGovernancePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeGovernance
): RuntimeResourceGovernancePlanningReports {
  const resource: RuntimeResourcePlanningReports = {
    runtimeResourceSummary: reports.runtimeResourceSummary,
    runtimeResourceForecast: reports.runtimeResourceForecast,
    runtimeResourceCapacity: reports.runtimeResourceCapacity,
    runtimeMemberWorkload: reports.runtimeMemberWorkload,
    runtimeResourceExplainability: reports.runtimeResourceExplainability,
  };
  const decision: RuntimeDecisionPlanningReports = {
    runtimeDecisionLineage: reports.runtimeDecisionLineage,
    runtimeDecisionSnapshot: reports.runtimeDecisionSnapshot,
    runtimeRecommendationSummary: reports.runtimeRecommendationSummary,
    runtimeDecisionCoherence: reports.runtimeDecisionCoherence,
  };
  const forecast: RuntimeForecastPlanningReports = {
    runtimeForecastSummary: reports.runtimeForecastSummary,
    runtimeForecastEscalation: reports.runtimeForecastEscalation,
    runtimeForecastGovernanceDrift: reports.runtimeForecastGovernanceDrift,
    runtimeForecastStability: reports.runtimeForecastStability,
  };

  const policyFindings = buildRuntimeResourcePolicyFindings({ resource, decision, forecast });
  const runtimeResourceGovernanceSummary = evaluateRuntimeResourceGovernance({
    resource,
    decision,
    forecast,
    policyFindings,
  });
  const runtimeResourceControlBoundary = evaluateRuntimeResourceControlBoundary(runtimeResourceGovernanceSummary);

  return {
    runtimeResourceGovernanceSummary,
    runtimeResourcePolicyFindings: policyFindings,
    runtimeResourceControlBoundary,
  };
}
