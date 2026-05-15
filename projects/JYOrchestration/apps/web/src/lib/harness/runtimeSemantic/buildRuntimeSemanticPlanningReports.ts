/**
 * H17–H18.5 — semantic groups·compression·quality·graph·narrative **planning 보고서** 일괄 산출.
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
import { auditHiddenRuntimeSemanticTrace } from "./auditHiddenRuntimeSemanticTrace";
import { buildRuntimeSemanticGroups } from "./buildRuntimeSemanticGroups";
import { compressRuntimeReasoningTrace } from "./compressRuntimeReasoningTrace";
import { evaluateRuntimeSemanticCompressionQuality } from "./evaluateRuntimeSemanticCompressionQuality";
import { evaluateRuntimeSemanticGroupBalance } from "./evaluateRuntimeSemanticGroupBalance";
import { evaluateRuntimeSemanticRedundancy } from "./evaluateRuntimeSemanticRedundancy";
import { stabilizeRuntimeSemanticOrdering } from "./stabilizeRuntimeSemanticOrdering";
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

export type RuntimeSemanticPlanningReports = RuntimeSemanticCorePlanningReports &
  Readonly<{
    semanticExplainabilityGraph: RuntimeSemanticExplainabilityGraph;
    semanticWarningOriginSummary: RuntimeSemanticWarningOriginSummary;
    semanticExplosionRiskSummary: RuntimeSemanticExplosionRiskSummary;
  }> &
  RuntimeSemanticNarrativePlanningReports;

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

  return { ...coreReports, ...graphReports, ...narrativeReports };
}

export type {
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticGraphRelevanceSummary,
};
