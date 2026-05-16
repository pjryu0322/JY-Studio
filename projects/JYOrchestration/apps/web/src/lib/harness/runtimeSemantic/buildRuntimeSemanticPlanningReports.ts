/**
 * H17–H22.5 — semantic·…·allocation·trial·control boundary **planning 보고서** 일괄 산출.
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type {
  RuntimeSemanticExplosionRiskSummary,
  RuntimeSemanticExplainabilityGraph,
  RuntimeSemanticWarningOriginSummary,
} from "@/lib/harness/runtimeSemanticGraph/runtimeSemanticGraphTypes";
import { buildRuntimeSemanticNarrativePlanningReports } from "@/lib/harness/runtimeSemanticNarrative/buildRuntimeSemanticNarrativePlanningReports";
import type {
  RuntimeSemanticGraphRelevanceSummary,
  RuntimeSemanticNarrativePlanningReports,
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
} from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import { buildRuntimeSemanticVocabularyPlanningReports } from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticVocabularyPlanningReports";
import type { RuntimeSemanticVocabularyPlanningReports } from "@/lib/harness/runtimeSemanticVocabulary/runtimeSemanticVocabularyTypes";
import { buildRuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionPlanningReports";
import type { RuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/runtimeDecisionTypes";
import { buildRuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/buildRuntimeForecastPlanningReports";
import type { RuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/runtimeForecastTypes";
import { buildRuntimeResourceGovernancePlanningReports } from "@/lib/harness/runtimeResourceGovernance/buildRuntimeResourceGovernancePlanningReports";
import { buildRuntimeResourceAllocationPlanningReports } from "@/lib/harness/runtimeResourceAllocation/buildRuntimeResourceAllocationPlanningReports";
import { buildRuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/buildRuntimeResourceTrialPlanningReports";
import { buildRuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/buildRuntimeControlBoundaryPlanningReports";
import { buildRuntimeResourcePlanningReports } from "@/lib/harness/runtimeResource/buildRuntimeResourcePlanningReports";
import { auditHiddenRuntimeSemanticTrace } from "./auditHiddenRuntimeSemanticTrace";
import { buildRuntimeSemanticGroups } from "./buildRuntimeSemanticGroups";
import { compressRuntimeReasoningTrace } from "./compressRuntimeReasoningTrace";
import { evaluateRuntimeSemanticCompressionQuality } from "./evaluateRuntimeSemanticCompressionQuality";
import { evaluateRuntimeSemanticGroupBalance } from "./evaluateRuntimeSemanticGroupBalance";
import { evaluateRuntimeSemanticRedundancy } from "./evaluateRuntimeSemanticRedundancy";
import { stabilizeRuntimeSemanticOrdering } from "./stabilizeRuntimeSemanticOrdering";
import type {
  RuntimeSemanticPlanningReportsBeforeGovernance,
  RuntimeSemanticPlanningReportsBeforeAllocation,
  RuntimeSemanticPlanningReportsBeforeTrial,
  RuntimeSemanticPlanningReportsBeforeControlBoundary,
  RuntimeSemanticCorePlanningReports,
} from "./runtimeSemanticPlanningReportStages";
import type { RuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/runtimeControlBoundaryTypes";

export type RuntimeSemanticPlanningReports = RuntimeSemanticPlanningReportsBeforeControlBoundary &
  RuntimeControlBoundaryPlanningReports;

export type {
  RuntimeSemanticCorePlanningReports,
  RuntimeSemanticPlanningReportsBeforeDecision,
  RuntimeSemanticPlanningReportsBeforeForecast,
  RuntimeSemanticPlanningReportsBeforeResource,
  RuntimeSemanticPlanningReportsBeforeGovernance,
  RuntimeSemanticPlanningReportsBeforeAllocation,
  RuntimeSemanticPlanningReportsBeforeTrial,
  RuntimeSemanticPlanningReportsBeforeControlBoundary,
} from "./runtimeSemanticPlanningReportStages";

export function buildRuntimeSemanticPlanningReports(
  reasoningReports: RuntimeReasoningPlanningReports
): RuntimeSemanticPlanningReports {
  const semanticGroupsSummary = buildRuntimeSemanticGroups(reasoningReports);
  const compressedReasoningTrace = compressRuntimeReasoningTrace(reasoningReports);
  const stabilizedSemanticOrdering = stabilizeRuntimeSemanticOrdering(
    semanticGroupsSummary,
    compressedReasoningTrace
  );
  const semanticRedundancySummary = evaluateRuntimeSemanticRedundancy(
    reasoningReports,
    semanticGroupsSummary
  );
  const hiddenTraceAudit = auditHiddenRuntimeSemanticTrace({
    reasoningReports,
    compressedReasoningTrace,
    semanticGroupsSummary,
    stabilizedSemanticOrdering,
  });
  const compressionQualityReport = evaluateRuntimeSemanticCompressionQuality({
    reasoningReports,
    semanticGroupsSummary,
    compressedReasoningTrace,
    semanticRedundancySummary,
    stabilizedSemanticOrdering,
    hiddenTraceAudit,
  });
  const semanticGroupBalanceSummary = evaluateRuntimeSemanticGroupBalance(semanticGroupsSummary);

  const coreReports: RuntimeSemanticCorePlanningReports = {
    semanticGroupsSummary,
    compressedReasoningTrace,
    semanticRedundancySummary,
    stabilizedSemanticOrdering,
    compressionQualityReport,
    hiddenTraceAudit,
    semanticGroupBalanceSummary,
  };

  const graphReports = buildRuntimeSemanticGraphPlanningReports(reasoningReports, coreReports);
  const narrativeReports = buildRuntimeSemanticNarrativePlanningReports(coreReports, graphReports);
  const vocabularyReports = buildRuntimeSemanticVocabularyPlanningReports(
    coreReports,
    graphReports,
    narrativeReports
  );

  const semanticWithVocabulary = {
    ...coreReports,
    ...graphReports,
    ...narrativeReports,
    ...vocabularyReports,
  };
  const semanticWithDecision = {
    ...semanticWithVocabulary,
    ...buildRuntimeDecisionPlanningReports(reasoningReports, semanticWithVocabulary),
  };
  const semanticWithForecast = {
    ...semanticWithDecision,
    ...buildRuntimeForecastPlanningReports(semanticWithDecision),
  };
  const resourceReports = buildRuntimeResourcePlanningReports(semanticWithForecast);
  const semanticWithResource: RuntimeSemanticPlanningReportsBeforeGovernance = {
    ...semanticWithForecast,
    ...resourceReports,
  };
  const governanceReports = buildRuntimeResourceGovernancePlanningReports(semanticWithResource);
  const semanticWithGovernance: RuntimeSemanticPlanningReportsBeforeAllocation = {
    ...semanticWithResource,
    ...governanceReports,
  };
  const allocationReports = buildRuntimeResourceAllocationPlanningReports(semanticWithGovernance);
  const semanticWithAllocation: RuntimeSemanticPlanningReportsBeforeTrial = {
    ...semanticWithGovernance,
    ...allocationReports,
  };
  const trialReports = buildRuntimeResourceTrialPlanningReports(semanticWithAllocation);
  const semanticWithTrial: RuntimeSemanticPlanningReportsBeforeControlBoundary = {
    ...semanticWithAllocation,
    ...trialReports,
  };
  const controlBoundaryReports = buildRuntimeControlBoundaryPlanningReports(semanticWithTrial);

  return { ...semanticWithTrial, ...controlBoundaryReports };
}

export type {
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticGraphRelevanceSummary,
};
