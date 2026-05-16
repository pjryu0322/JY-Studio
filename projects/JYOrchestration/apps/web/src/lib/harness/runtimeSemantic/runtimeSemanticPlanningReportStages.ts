/**
 * H17–H22 — semantic planning report **단계 타입**(빌더 간 순환 참조 방지).
 */

import type { RuntimeResourceAllocationPlanningReports } from "@/lib/harness/runtimeResourceAllocation/runtimeResourceAllocationTypes";

import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import type { RuntimeResourceGovernancePlanningReports } from "@/lib/harness/runtimeResourceGovernance/runtimeResourceGovernanceTypes";
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

export type RuntimeSemanticPlanningReportsBeforeAllocation = RuntimeSemanticPlanningReportsBeforeGovernance &
  RuntimeResourceGovernancePlanningReports;

export type RuntimeSemanticPlanningReportsBeforeTrial = RuntimeSemanticPlanningReportsBeforeAllocation &
  RuntimeResourceAllocationPlanningReports;
