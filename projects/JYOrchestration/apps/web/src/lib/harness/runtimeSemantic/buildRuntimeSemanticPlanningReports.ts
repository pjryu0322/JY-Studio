/**
 * H17–H25 — semantic·…·pilot contract·no-op adapter **planning 보고서** 일괄 산출.
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
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
} from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import { buildRuntimeSemanticVocabularyPlanningReports } from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticVocabularyPlanningReports";
import { buildRuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionPlanningReports";
import { buildRuntimeForecastPlanningReports } from "@/lib/harness/runtimeForecast/buildRuntimeForecastPlanningReports";
import { buildRuntimeResourceGovernancePlanningReports } from "@/lib/harness/runtimeResourceGovernance/buildRuntimeResourceGovernancePlanningReports";
import { buildRuntimeResourceAllocationPlanningReports } from "@/lib/harness/runtimeResourceAllocation/buildRuntimeResourceAllocationPlanningReports";
import { buildRuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/buildRuntimeResourceTrialPlanningReports";
import { buildRuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/buildRuntimeControlBoundaryPlanningReports";
import { buildRuntimeExecutionCandidatePlanningReports } from "@/lib/harness/runtimeExecutionCandidate/buildRuntimeExecutionCandidatePlanningReports";
import { buildRuntimeOperatorApprovalPlanningReports } from "@/lib/harness/runtimeOperatorApproval/buildRuntimeOperatorApprovalPlanningReports";
import { buildRuntimeControlledPilotPlanningReports } from "@/lib/harness/runtimeControlledPilot/buildRuntimeControlledPilotPlanningReports";
import { buildRuntimePilotContractPlanningReports } from "@/lib/harness/runtimePilotContract/buildRuntimePilotContractPlanningReports";
import { buildRuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/buildRuntimeNoopAdapterPlanningReports";
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
  RuntimeSemanticPlanningReportsBeforeExecutionCandidate,
  RuntimeSemanticPlanningReportsBeforeOperatorApproval,
  RuntimeSemanticPlanningReportsBeforeControlledPilot,
  RuntimeSemanticPlanningReportsBeforePilotContract,
  RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  RuntimeSemanticPlanningReports,
  RuntimeSemanticCorePlanningReports,
} from "./runtimeSemanticPlanningReportStages";

export type {
  RuntimeSemanticCorePlanningReports,
  RuntimeSemanticPlanningReportsBeforeDecision,
  RuntimeSemanticPlanningReportsBeforeForecast,
  RuntimeSemanticPlanningReportsBeforeResource,
  RuntimeSemanticPlanningReportsBeforeGovernance,
  RuntimeSemanticPlanningReportsBeforeAllocation,
  RuntimeSemanticPlanningReportsBeforeTrial,
  RuntimeSemanticPlanningReportsBeforeControlBoundary,
  RuntimeSemanticPlanningReportsBeforeExecutionCandidate,
  RuntimeSemanticPlanningReportsBeforeOperatorApproval,
  RuntimeSemanticPlanningReportsBeforeControlledPilot,
  RuntimeSemanticPlanningReportsBeforePilotContract,
  RuntimeSemanticPlanningReportsBeforeNoopAdapter,
  RuntimeSemanticPlanningReports,
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
  const semanticWithControlBoundary: RuntimeSemanticPlanningReportsBeforeExecutionCandidate = {
    ...semanticWithTrial,
    ...controlBoundaryReports,
  };
  const executionCandidateReports = buildRuntimeExecutionCandidatePlanningReports(semanticWithControlBoundary);
  const semanticWithExecutionCandidate: RuntimeSemanticPlanningReportsBeforeOperatorApproval = {
    ...semanticWithControlBoundary,
    ...executionCandidateReports,
  };
  const operatorApprovalReports = buildRuntimeOperatorApprovalPlanningReports(semanticWithExecutionCandidate);
  const semanticWithOperatorApproval: RuntimeSemanticPlanningReportsBeforeControlledPilot = {
    ...semanticWithExecutionCandidate,
    ...operatorApprovalReports,
  };
  const controlledPilotReports = buildRuntimeControlledPilotPlanningReports(semanticWithOperatorApproval);
  const semanticWithControlledPilot: RuntimeSemanticPlanningReportsBeforePilotContract = {
    ...semanticWithOperatorApproval,
    ...controlledPilotReports,
  };
  const pilotContractReports = buildRuntimePilotContractPlanningReports(semanticWithControlledPilot);
  const semanticWithPilotContract: RuntimeSemanticPlanningReportsBeforeNoopAdapter = {
    ...semanticWithControlledPilot,
    ...pilotContractReports,
  };
  const noopAdapterReports = buildRuntimeNoopAdapterPlanningReports(semanticWithPilotContract);

  return { ...semanticWithPilotContract, ...noopAdapterReports };
}

export type {
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticGraphRelevanceSummary,
};
