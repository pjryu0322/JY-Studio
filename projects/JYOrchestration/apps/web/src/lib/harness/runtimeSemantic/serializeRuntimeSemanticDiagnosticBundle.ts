/**
 * H17–H22 — 진단 API용 runtime semantic·…·allocation·trial wire 묶음.
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
import {
  serializeRuntimeSemanticNormalizedLabelsForDiagnostic,
  serializeRuntimeSemanticVocabularySummaryForDiagnostic,
} from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticVocabularyDictionary";
import { serializeRuntimeSemanticPriorityVocabularyForDiagnostic } from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticPriorityVocabulary";
import { serializeRuntimeDecisionLineageForDiagnostic } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionLineage";
import { serializeRuntimeDecisionSnapshotForDiagnostic } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionSnapshot";
import { serializeRuntimeRecommendationSummaryForDiagnostic } from "@/lib/harness/runtimeDecision/buildRuntimeRecommendationSummary";
import { serializeRuntimeDecisionCoherenceForDiagnostic } from "@/lib/harness/runtimeDecision/evaluateRuntimeDecisionCoherence";
import { serializeRuntimeForecastSummaryForDiagnostic } from "@/lib/harness/runtimeForecast/buildRuntimeForecastSummary";
import { serializeRuntimeForecastEscalationForDiagnostic } from "@/lib/harness/runtimeForecast/predictRuntimeEscalationChains";
import { serializeRuntimeForecastGovernanceDriftForDiagnostic } from "@/lib/harness/runtimeForecast/predictRuntimeGovernanceDrift";
import { serializeRuntimeForecastStabilityForDiagnostic } from "@/lib/harness/runtimeForecast/evaluateRuntimeForecastStability";
import { serializeRuntimeResourceSummaryForDiagnostic } from "@/lib/harness/runtimeResource/buildRuntimeResourceSummary";
import {
  serializeRuntimeResourceCapacityForDiagnostic,
  serializeRuntimeResourceForecastForDiagnostic,
} from "@/lib/harness/runtimeResource/forecastRuntimeResourceCapacity";
import { serializeRuntimeMemberWorkloadForDiagnostic } from "@/lib/harness/runtimeResource/evaluateRuntimeMemberWorkload";
import { serializeRuntimeResourceExplainabilityForDiagnostic } from "@/lib/harness/runtimeResource/buildRuntimeResourceExplainability";
import { serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceGovernance/serializeRuntimeResourceGovernanceDiagnosticBundle";
import { serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceAllocation/serializeRuntimeResourceAllocationDiagnosticBundle";
import { serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceTrial/serializeRuntimeResourceTrialDiagnosticBundle";

type SerializedRuntimeResourceGovernanceDiag = ReturnType<
  typeof serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeResourceAllocationDiag = ReturnType<
  typeof serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeResourceTrialDiag = ReturnType<
  typeof serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports
>;

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
  runtimeSemanticVocabularySummary: ReturnType<typeof serializeRuntimeSemanticVocabularySummaryForDiagnostic>;
  runtimeSemanticNormalizedLabels: ReturnType<typeof serializeRuntimeSemanticNormalizedLabelsForDiagnostic>;
  runtimeSemanticPriorityVocabulary: ReturnType<typeof serializeRuntimeSemanticPriorityVocabularyForDiagnostic>;
  runtimeDecisionLineage: ReturnType<typeof serializeRuntimeDecisionLineageForDiagnostic>;
  runtimeDecisionSnapshot: ReturnType<typeof serializeRuntimeDecisionSnapshotForDiagnostic>;
  runtimeRecommendationSummary: ReturnType<typeof serializeRuntimeRecommendationSummaryForDiagnostic>;
  runtimeDecisionCoherence: ReturnType<typeof serializeRuntimeDecisionCoherenceForDiagnostic>;
  runtimeForecastSummary: ReturnType<typeof serializeRuntimeForecastSummaryForDiagnostic>;
  runtimeForecastEscalation: ReturnType<typeof serializeRuntimeForecastEscalationForDiagnostic>;
  runtimeForecastGovernanceDrift: ReturnType<typeof serializeRuntimeForecastGovernanceDriftForDiagnostic>;
  runtimeForecastStability: ReturnType<typeof serializeRuntimeForecastStabilityForDiagnostic>;
  runtimeResourceSummary: ReturnType<typeof serializeRuntimeResourceSummaryForDiagnostic>;
  runtimeResourceForecast: ReturnType<typeof serializeRuntimeResourceForecastForDiagnostic>;
  runtimeResourceCapacity: ReturnType<typeof serializeRuntimeResourceCapacityForDiagnostic>;
  runtimeMemberWorkload: ReturnType<typeof serializeRuntimeMemberWorkloadForDiagnostic>;
  runtimeResourceExplainability: ReturnType<typeof serializeRuntimeResourceExplainabilityForDiagnostic>;
  runtimeResourceGovernanceSummary: SerializedRuntimeResourceGovernanceDiag["runtimeResourceGovernanceSummary"];
  runtimeResourcePolicyFindings: SerializedRuntimeResourceGovernanceDiag["runtimeResourcePolicyFindings"];
  runtimeResourceControlBoundary: SerializedRuntimeResourceGovernanceDiag["runtimeResourceControlBoundary"];
  runtimeResourceAllocationPlan: SerializedRuntimeResourceAllocationDiag["runtimeResourceAllocationPlan"];
  runtimeAllocationEligibilitySummary: SerializedRuntimeResourceAllocationDiag["runtimeAllocationEligibilitySummary"];
  runtimeProviderSlotPlan: SerializedRuntimeResourceAllocationDiag["runtimeProviderSlotPlan"];
  runtimeExecutionSlotPlan: SerializedRuntimeResourceAllocationDiag["runtimeExecutionSlotPlan"];
  runtimeResourceAllocationTrialReport: SerializedRuntimeResourceTrialDiag["runtimeResourceAllocationTrialReport"];
  runtimeAllocationForecastComparison: SerializedRuntimeResourceTrialDiag["runtimeAllocationForecastComparison"];
  runtimeAllocationGovernanceComparison: SerializedRuntimeResourceTrialDiag["runtimeAllocationGovernanceComparison"];
  runtimeAllocationTrialDriftSummary: SerializedRuntimeResourceTrialDiag["runtimeAllocationTrialDriftSummary"];
}> {
  const governanceDiag = serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports(reports);
  const allocationDiag = serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports(reports);
  const trialDiag = serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports(reports);
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
    runtimeSemanticVocabularySummary: serializeRuntimeSemanticVocabularySummaryForDiagnostic(
      reports.semanticVocabularySummary
    ),
    runtimeSemanticNormalizedLabels: serializeRuntimeSemanticNormalizedLabelsForDiagnostic(
      reports.semanticNormalizedLabels
    ),
    runtimeSemanticPriorityVocabulary: serializeRuntimeSemanticPriorityVocabularyForDiagnostic(
      reports.semanticPriorityVocabulary
    ),
    runtimeDecisionLineage: serializeRuntimeDecisionLineageForDiagnostic(reports.runtimeDecisionLineage),
    runtimeDecisionSnapshot: serializeRuntimeDecisionSnapshotForDiagnostic(reports.runtimeDecisionSnapshot),
    runtimeRecommendationSummary: serializeRuntimeRecommendationSummaryForDiagnostic(
      reports.runtimeRecommendationSummary
    ),
    runtimeDecisionCoherence: serializeRuntimeDecisionCoherenceForDiagnostic(reports.runtimeDecisionCoherence),
    runtimeForecastSummary: serializeRuntimeForecastSummaryForDiagnostic(reports.runtimeForecastSummary),
    runtimeForecastEscalation: serializeRuntimeForecastEscalationForDiagnostic(reports.runtimeForecastEscalation),
    runtimeForecastGovernanceDrift: serializeRuntimeForecastGovernanceDriftForDiagnostic(
      reports.runtimeForecastGovernanceDrift
    ),
    runtimeForecastStability: serializeRuntimeForecastStabilityForDiagnostic(reports.runtimeForecastStability),
    runtimeResourceSummary: serializeRuntimeResourceSummaryForDiagnostic(reports.runtimeResourceSummary),
    runtimeResourceForecast: serializeRuntimeResourceForecastForDiagnostic(reports.runtimeResourceForecast),
    runtimeResourceCapacity: serializeRuntimeResourceCapacityForDiagnostic(reports.runtimeResourceCapacity),
    runtimeMemberWorkload: serializeRuntimeMemberWorkloadForDiagnostic(reports.runtimeMemberWorkload),
    runtimeResourceExplainability: serializeRuntimeResourceExplainabilityForDiagnostic(
      reports.runtimeResourceExplainability
    ),
    ...governanceDiag,
    ...allocationDiag,
    ...trialDiag,
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
