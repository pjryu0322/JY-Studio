/**
 * H17–H21 — semantic·vocabulary·decision·forecast·resource·governance **planning 보고서** 일괄 산출.
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
import {
  buildRuntimeResourceGovernancePlanningReports,
  type RuntimeResourceGovernancePlanningReports,
} from "@/lib/harness/runtimeResourceGovernance/buildRuntimeResourceGovernancePlanningReports";
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
  RuntimeSemanticCorePlanningReports,
} from "./runtimeSemanticPlanningReportStages";

export type RuntimeSemanticPlanningReports = RuntimeSemanticPlanningReportsBeforeGovernance &
  RuntimeResourceGovernancePlanningReports;

export type {
  RuntimeSemanticCorePlanningReports,
  RuntimeSemanticPlanningReportsBeforeDecision,
  RuntimeSemanticPlanningReportsBeforeForecast,
  RuntimeSemanticPlanningReportsBeforeResource,
  RuntimeSemanticPlanningReportsBeforeGovernance,
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

  return { ...semanticWithResource, ...governanceReports };
}

export type {
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticGraphRelevanceSummary,
};
