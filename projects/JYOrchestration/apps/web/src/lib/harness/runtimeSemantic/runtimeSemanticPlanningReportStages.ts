/**
 * H17–H23.5 — semantic planning report **단계 타입**(빌더 간 순환 참조 방지).
 */

import type { RuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/runtimeControlBoundaryTypes";
import type { RuntimeExecutionCandidatePlanningReports } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateTypes";
import type { RuntimeOperatorApprovalPlanningReports } from "@/lib/harness/runtimeOperatorApproval/runtimeOperatorApprovalTypes";

import type { RuntimeResourceAllocationPlanningReports } from "@/lib/harness/runtimeResourceAllocation/runtimeResourceAllocationTypes";
import type { RuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/runtimeResourceTrialTypes";

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

/** H22 포함·H22.5 직전(trial까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforeControlBoundary = RuntimeSemanticPlanningReportsBeforeTrial &
  RuntimeResourceTrialPlanningReports;

/** H22.5 포함·H23 직전(control boundary까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforeExecutionCandidate = RuntimeSemanticPlanningReportsBeforeControlBoundary &
  RuntimeControlBoundaryPlanningReports;

/** H23 포함·H23.5 직전(execution candidate까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforeOperatorApproval = RuntimeSemanticPlanningReportsBeforeExecutionCandidate &
  RuntimeExecutionCandidatePlanningReports;

/** H23.5 포함 — operator approval·rollback·audit·pilot precondition 메타까지 산출된 상태. */
export type RuntimeSemanticPlanningReports = RuntimeSemanticPlanningReportsBeforeOperatorApproval &
  RuntimeOperatorApprovalPlanningReports;
