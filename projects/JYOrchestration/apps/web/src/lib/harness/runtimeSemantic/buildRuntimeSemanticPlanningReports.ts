/**
 * H17–H35 — semantic·…·release-gate final safety gate·release-gate final preflight **planning 보고서** 일괄 산출.
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
import { buildRuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/buildRuntimeAdapterSandboxPlanningReports";
import { buildRuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationPlanningReports";
import { buildRuntimePilotSkeletonPlanningReports } from "@/lib/harness/runtimePilotSkeleton/buildRuntimePilotSkeletonPlanningReports";
import { buildRuntimeRunnerInvocationPlanningReports } from "@/lib/harness/runtimeRunnerInvocation/buildRuntimeRunnerInvocationPlanningReports";
import { buildRuntimeRunnerNoopHarnessPlanningReports } from "@/lib/harness/runtimeRunnerNoopHarness/buildRuntimeRunnerNoopHarnessPlanningReports";
import { buildRuntimeNoopExecutionShellPlanningReports } from "@/lib/harness/runtimeNoopExecutionShell/buildRuntimeNoopExecutionShellPlanningReports";
import { buildRuntimeNoopExecutionShellHarnessPlanningReports } from "@/lib/harness/runtimeNoopExecutionShellHarness/buildRuntimeNoopExecutionShellHarnessPlanningReports";
import { buildRuntimeNoopShellHardeningPlanningReports } from "@/lib/harness/runtimeNoopShellHardening/buildRuntimeNoopShellHardeningPlanningReports";
import { buildRuntimeNoopShellReleaseGatePlanningReports } from "@/lib/harness/runtimeNoopShellReleaseGate/buildRuntimeNoopShellReleaseGatePlanningReports";
import { buildRuntimeReleaseGatePreflightPlanningReports } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGatePreflightPlanningReports";
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
  RuntimeSemanticPlanningReportsBeforeAdapterSandbox,
  RuntimeSemanticPlanningReportsBeforePilotActivation,
  RuntimeSemanticPlanningReportsBeforePilotSkeleton,
  RuntimeSemanticPlanningReportsBeforeRunnerInvocation,
  RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness,
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
  RuntimeSemanticPlanningReportsBeforeAdapterSandbox,
  RuntimeSemanticPlanningReportsBeforePilotActivation,
  RuntimeSemanticPlanningReportsBeforePilotSkeleton,
  RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness,
  RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight,
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
  const semanticWithNoopAdapter: RuntimeSemanticPlanningReportsBeforeAdapterSandbox = {
    ...semanticWithPilotContract,
    ...noopAdapterReports,
  };
  const adapterSandboxReports = buildRuntimeAdapterSandboxPlanningReports(semanticWithNoopAdapter);
  const semanticWithAdapterSandbox: RuntimeSemanticPlanningReportsBeforePilotActivation = {
    ...semanticWithNoopAdapter,
    ...adapterSandboxReports,
  };
  const pilotActivationReports = buildRuntimePilotActivationPlanningReports(semanticWithAdapterSandbox);
  const semanticWithPilotActivation: RuntimeSemanticPlanningReportsBeforePilotSkeleton = {
    ...semanticWithAdapterSandbox,
    ...pilotActivationReports,
  };
  const pilotSkeletonReports = buildRuntimePilotSkeletonPlanningReports(semanticWithPilotActivation);
  const semanticWithPilotSkeleton: RuntimeSemanticPlanningReportsBeforeRunnerInvocation = {
    ...semanticWithPilotActivation,
    ...pilotSkeletonReports,
  };
  const runnerInvocationReports = buildRuntimeRunnerInvocationPlanningReports(semanticWithPilotSkeleton);
  const semanticWithRunnerInvocation: RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness = {
    ...semanticWithPilotSkeleton,
    ...runnerInvocationReports,
  };
  const runnerNoopHarnessReports = buildRuntimeRunnerNoopHarnessPlanningReports(semanticWithRunnerInvocation);
  const semanticWithRunnerNoopHarness = {
    ...semanticWithRunnerInvocation,
    ...runnerNoopHarnessReports,
  };
  const noopExecutionShellReports = buildRuntimeNoopExecutionShellPlanningReports(semanticWithRunnerNoopHarness);
  const semanticWithNoopExecutionShell = {
    ...semanticWithRunnerNoopHarness,
    ...noopExecutionShellReports,
  };
  const noopExecutionShellHarnessReports =
    buildRuntimeNoopExecutionShellHarnessPlanningReports(semanticWithNoopExecutionShell);
  const semanticWithExecutionShellHarness = {
    ...semanticWithNoopExecutionShell,
    ...noopExecutionShellHarnessReports,
  };
  const noopShellHardeningReports = buildRuntimeNoopShellHardeningPlanningReports(semanticWithExecutionShellHarness);
  const semanticWithNoopShellHardening = {
    ...semanticWithExecutionShellHarness,
    ...noopShellHardeningReports,
  };
  const noopShellReleaseGateReports =
    buildRuntimeNoopShellReleaseGatePlanningReports(semanticWithNoopShellHardening);
  const semanticWithNoopShellReleaseGate = {
    ...semanticWithNoopShellHardening,
    ...noopShellReleaseGateReports,
  };
  const releaseGatePreflightReports =
    buildRuntimeReleaseGatePreflightPlanningReports(semanticWithNoopShellReleaseGate);

  return { ...semanticWithNoopShellReleaseGate, ...releaseGatePreflightReports };
}

export type {
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticGraphRelevanceSummary,
};
