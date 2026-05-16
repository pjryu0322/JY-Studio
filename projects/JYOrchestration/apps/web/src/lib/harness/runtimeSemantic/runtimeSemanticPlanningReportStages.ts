/**
 * H17–H21 — semantic planning report **단계 타입**(빌더 간 순환 참조 방지).
 */

import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import type { RuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type {
  RuntimeSemanticExplosionRiskSummary,
  RuntimeSemanticExplainabilityGraph,
  RuntimeSemanticWarningOriginSummary,
} from "@/lib/harness/runtimeSemanticGraph/runtimeSemanticGraphTypes";
import type {
  RuntimeSemanticNarrativePlanningReports,
} from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import type { RuntimeSemanticVocabularyPlanningReports } from "@/lib/harness/runtimeSemanticVocabulary/runtimeSemanticVocabularyTypes";
import type {
  CompressedRuntimeReasoningTrace,
  RuntimeSemanticGroupsSummary,
  RuntimeSemanticRedundancySummary,
  StabilizedRuntimeSemanticOrdering,
} from "./runtimeSemanticTypes";
import type {
  RuntimeHiddenSemanticTraceAudit,
  RuntimeSemanticCompressionQualityReport,
  RuntimeSemanticGroupBalanceSummary,
} from "./runtimeSemanticQualityTypes";

export type RuntimeSemanticCorePlanningReports = Readonly<{
  semanticGroupsSummary: RuntimeSemanticGroupsSummary;
  compressedReasoningTrace: CompressedRuntimeReasoningTrace;
  semanticRedundancySummary: RuntimeSemanticRedundancySummary;
  stabilizedSemanticOrdering: StabilizedRuntimeSemanticOrdering;
  compressionQualityReport: RuntimeSemanticCompressionQualityReport;
  hiddenTraceAudit: RuntimeHiddenSemanticTraceAudit;
  semanticGroupBalanceSummary: RuntimeSemanticGroupBalanceSummary;
}>;

export type RuntimeSemanticPlanningReportsBeforeDecision = RuntimeSemanticCorePlanningReports &
  Readonly<{
    semanticExplainabilityGraph: RuntimeSemanticExplainabilityGraph;
    semanticWarningOriginSummary: RuntimeSemanticWarningOriginSummary;
    semanticExplosionRiskSummary: RuntimeSemanticExplosionRiskSummary;
  }> &
  RuntimeSemanticNarrativePlanningReports &
  RuntimeSemanticVocabularyPlanningReports;

export type RuntimeSemanticPlanningReportsBeforeForecast = RuntimeSemanticPlanningReportsBeforeDecision &
  RuntimeDecisionPlanningReports;

export type RuntimeSemanticPlanningReportsBeforeResource = RuntimeSemanticPlanningReportsBeforeForecast &
  RuntimeForecastPlanningReports;

export type RuntimeSemanticPlanningReportsBeforeGovernance = RuntimeSemanticPlanningReportsBeforeResource &
  RuntimeResourcePlanningReports;
