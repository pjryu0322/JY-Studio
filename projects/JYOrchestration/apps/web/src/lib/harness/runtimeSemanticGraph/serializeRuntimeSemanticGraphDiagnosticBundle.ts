/**
 * H18 — 진단 API용 semantic explainability graph wire 묶음.
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildRuntimeSemanticGraphPlanningReports, type RuntimeSemanticGraphPlanningReports } from "./buildRuntimeSemanticGraphPlanningReports";
import { serializeRuntimeSemanticExplainabilityGraphForDiagnostic } from "./buildRuntimeSemanticExplainabilityGraph";
import { serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic } from "./evaluateRuntimeSemanticExplosionRisk";
import { serializeRuntimeSemanticWarningOriginSummaryForDiagnostic } from "./resolveRuntimeSemanticWarningOrigins";

export function serializeRuntimeSemanticGraphDiagnosticBundleFromPlanningReports(
  reports: RuntimeSemanticGraphPlanningReports
): Readonly<{
  runtimeSemanticExplainabilityGraph: ReturnType<typeof serializeRuntimeSemanticExplainabilityGraphForDiagnostic>;
  runtimeSemanticWarningOriginSummary: ReturnType<typeof serializeRuntimeSemanticWarningOriginSummaryForDiagnostic>;
  runtimeSemanticExplosionRiskSummary: ReturnType<typeof serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic>;
}> {
  return {
    runtimeSemanticExplainabilityGraph: serializeRuntimeSemanticExplainabilityGraphForDiagnostic(
      reports.semanticExplainabilityGraph
    ),
    runtimeSemanticWarningOriginSummary: serializeRuntimeSemanticWarningOriginSummaryForDiagnostic(
      reports.semanticWarningOriginSummary
    ),
    runtimeSemanticExplosionRiskSummary: serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic(
      reports.semanticExplosionRiskSummary
    ),
  };
}

export function serializeRuntimeSemanticGraphDiagnosticBundleFromReports(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticCorePlanningReports
): ReturnType<typeof serializeRuntimeSemanticGraphDiagnosticBundleFromPlanningReports> {
  return serializeRuntimeSemanticGraphDiagnosticBundleFromPlanningReports(
    buildRuntimeSemanticGraphPlanningReports(reasoningReports, semanticReports)
  );
}
