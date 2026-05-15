/**
 * H17–H18.5 — 진단 API용 runtime semantic wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { buildRuntimeSemanticPlanningReports, type RuntimeSemanticPlanningReports } from "./buildRuntimeSemanticPlanningReports";
import { serializeRuntimeHiddenSemanticTraceAuditForDiagnostic } from "./auditHiddenRuntimeSemanticTrace";
import { serializeRuntimeSemanticGroupsSummaryForDiagnostic } from "./buildRuntimeSemanticGroups";
import { serializeCompressedRuntimeReasoningTraceForDiagnostic } from "./compressRuntimeReasoningTrace";
import { serializeRuntimeSemanticCompressionQualityReportForDiagnostic } from "./evaluateRuntimeSemanticCompressionQuality";
import { serializeRuntimeSemanticGroupBalanceSummaryForDiagnostic } from "./evaluateRuntimeSemanticGroupBalance";
import { serializeRuntimeSemanticRedundancySummaryForDiagnostic } from "./evaluateRuntimeSemanticRedundancy";
import { serializeStabilizedRuntimeSemanticOrderingForDiagnostic } from "./stabilizeRuntimeSemanticOrdering";
import { serializeRuntimeSemanticExplainabilityGraphForDiagnostic } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticExplainabilityGraph";
import { serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic } from "@/lib/harness/runtimeSemanticGraph/evaluateRuntimeSemanticExplosionRisk";
import { serializeRuntimeSemanticWarningOriginSummaryForDiagnostic } from "@/lib/harness/runtimeSemanticGraph/resolveRuntimeSemanticWarningOrigins";
import { serializeRuntimeSemanticNarrativeSummaryForDiagnostic } from "@/lib/harness/runtimeSemanticNarrative/buildRuntimeSemanticNarratives";
import { serializeRuntimeSemanticRootCauseGroupsForDiagnostic } from "@/lib/harness/runtimeSemanticNarrative/consolidateRuntimeSemanticRootCauses";
import { serializeRuntimeSemanticGraphRelevanceSummaryForDiagnostic } from "@/lib/harness/runtimeSemanticNarrative/evaluateRuntimeSemanticGraphRelevance";

export function serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeSemanticGroups: ReturnType<typeof serializeRuntimeSemanticGroupsSummaryForDiagnostic>;
  compressedRuntimeReasoningTrace: ReturnType<typeof serializeCompressedRuntimeReasoningTraceForDiagnostic>;
  runtimeSemanticRedundancySummary: ReturnType<typeof serializeRuntimeSemanticRedundancySummaryForDiagnostic>;
  stabilizedRuntimeSemanticOrdering: ReturnType<typeof serializeStabilizedRuntimeSemanticOrderingForDiagnostic>;
  runtimeSemanticCompressionQualityReport: ReturnType<
    typeof serializeRuntimeSemanticCompressionQualityReportForDiagnostic
  >;
  runtimeHiddenSemanticTraceAudit: ReturnType<typeof serializeRuntimeHiddenSemanticTraceAuditForDiagnostic>;
  runtimeSemanticGroupBalanceSummary: ReturnType<typeof serializeRuntimeSemanticGroupBalanceSummaryForDiagnostic>;
  runtimeSemanticExplainabilityGraph: ReturnType<typeof serializeRuntimeSemanticExplainabilityGraphForDiagnostic>;
  runtimeSemanticWarningOriginSummary: ReturnType<typeof serializeRuntimeSemanticWarningOriginSummaryForDiagnostic>;
  runtimeSemanticExplosionRiskSummary: ReturnType<typeof serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic>;
  runtimeSemanticNarrativeSummary: ReturnType<typeof serializeRuntimeSemanticNarrativeSummaryForDiagnostic>;
  runtimeSemanticRootCauseGroups: ReturnType<typeof serializeRuntimeSemanticRootCauseGroupsForDiagnostic>;
  runtimeSemanticGraphRelevanceSummary: ReturnType<typeof serializeRuntimeSemanticGraphRelevanceSummaryForDiagnostic>;
}> {
  return {
    runtimeSemanticGroups: serializeRuntimeSemanticGroupsSummaryForDiagnostic(reports.semanticGroupsSummary),
    compressedRuntimeReasoningTrace: serializeCompressedRuntimeReasoningTraceForDiagnostic(
      reports.compressedReasoningTrace
    ),
    runtimeSemanticRedundancySummary: serializeRuntimeSemanticRedundancySummaryForDiagnostic(
      reports.semanticRedundancySummary
    ),
    stabilizedRuntimeSemanticOrdering: serializeStabilizedRuntimeSemanticOrderingForDiagnostic(
      reports.stabilizedSemanticOrdering
    ),
    runtimeSemanticCompressionQualityReport: serializeRuntimeSemanticCompressionQualityReportForDiagnostic(
      reports.compressionQualityReport
    ),
    runtimeHiddenSemanticTraceAudit: serializeRuntimeHiddenSemanticTraceAuditForDiagnostic(
      reports.hiddenTraceAudit
    ),
    runtimeSemanticGroupBalanceSummary: serializeRuntimeSemanticGroupBalanceSummaryForDiagnostic(
      reports.semanticGroupBalanceSummary
    ),
    runtimeSemanticExplainabilityGraph: serializeRuntimeSemanticExplainabilityGraphForDiagnostic(
      reports.semanticExplainabilityGraph
    ),
    runtimeSemanticWarningOriginSummary: serializeRuntimeSemanticWarningOriginSummaryForDiagnostic(
      reports.semanticWarningOriginSummary
    ),
    runtimeSemanticExplosionRiskSummary: serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic(
      reports.semanticExplosionRiskSummary
    ),
    runtimeSemanticNarrativeSummary: serializeRuntimeSemanticNarrativeSummaryForDiagnostic(
      reports.semanticNarrativeSummary
    ),
    runtimeSemanticRootCauseGroups: serializeRuntimeSemanticRootCauseGroupsForDiagnostic(
      reports.semanticRootCauseGroups
    ),
    runtimeSemanticGraphRelevanceSummary: serializeRuntimeSemanticGraphRelevanceSummaryForDiagnostic(
      reports.semanticGraphRelevanceSummary
    ),
  };
}

export function serializeRuntimeSemanticDiagnosticBundleFromReports(
  reasoningReports: RuntimeReasoningPlanningReports
): ReturnType<typeof serializeRuntimeSemanticDiagnosticBundleFromPlanningReports> {
  return serializeRuntimeSemanticDiagnosticBundleFromPlanningReports(
    buildRuntimeSemanticPlanningReports(reasoningReports)
  );
}

export function serializeRuntimeSemanticDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeSemanticDiagnosticBundleFromPlanningReports> {
  const dependencyReports = buildRuntimeDependencyPlanningReports(ctx);
  const criticalityReports = buildRuntimeCriticalityPlanningReports(ctx, dependencyReports);
  const traceabilityReports = buildRuntimeTraceabilityPlanningReports(
    ctx,
    dependencyReports,
    criticalityReports
  );
  const reasoningReports = buildRuntimeReasoningPlanningReports(
    dependencyReports,
    criticalityReports,
    traceabilityReports
  );
  return serializeRuntimeSemanticDiagnosticBundleFromReports(reasoningReports);
}
