/**
 * H17–H28 — 진단 API용 runtime semantic·…·pilot skeleton wire 묶음.
 */

import { serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlledPilot/serializeRuntimeControlledPilotDiagnosticBundle";
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
import { serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlBoundary/serializeRuntimeControlBoundaryDiagnosticBundle";
import { serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeExecutionCandidate/serializeRuntimeExecutionCandidateDiagnosticBundle";
import { serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeOperatorApproval/serializeRuntimeOperatorApprovalDiagnosticBundle";
import { serializeRuntimePilotContractDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotContract/serializeRuntimePilotContractDiagnosticBundle";
import { serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeNoopAdapter/serializeRuntimeNoopAdapterDiagnosticBundle";
import { serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeAdapterSandbox/serializeRuntimeAdapterSandboxDiagnosticBundle";
import { serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotActivation/serializeRuntimePilotActivationDiagnosticBundle";
import { serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotSkeleton/serializeRuntimePilotSkeletonDiagnosticBundle";
import { serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeRunnerInvocation/serializeRuntimeRunnerInvocationDiagnosticBundle";

type SerializedRuntimeResourceGovernanceDiag = ReturnType<
  typeof serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeResourceAllocationDiag = ReturnType<
  typeof serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeResourceTrialDiag = ReturnType<
  typeof serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeControlBoundaryDiag = ReturnType<
  typeof serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeExecutionCandidateDiag = ReturnType<
  typeof serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeOperatorApprovalDiag = ReturnType<
  typeof serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeControlledPilotDiag = ReturnType<
  typeof serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimePilotContractDiag = ReturnType<
  typeof serializeRuntimePilotContractDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeNoopAdapterDiag = ReturnType<
  typeof serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeAdapterSandboxDiag = ReturnType<
  typeof serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimePilotActivationDiag = ReturnType<
  typeof serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimePilotSkeletonDiag = ReturnType<
  typeof serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports
>;
type SerializedRuntimeRunnerInvocationDiag = ReturnType<
  typeof serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports
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
  runtimeControlBoundarySummary: SerializedRuntimeControlBoundaryDiag["runtimeControlBoundarySummary"];
  runtimeControlBoundaryViolationReport: SerializedRuntimeControlBoundaryDiag["runtimeControlBoundaryViolationReport"];
  runtimeControlScopeMatrix: SerializedRuntimeControlBoundaryDiag["runtimeControlScopeMatrix"];
  runtimeExecutionCandidateSummary: SerializedRuntimeExecutionCandidateDiag["runtimeExecutionCandidateSummary"];
  runtimeExecutionCandidateScope: SerializedRuntimeExecutionCandidateDiag["runtimeExecutionCandidateScope"];
  runtimeExecutionCandidatePreconditions: SerializedRuntimeExecutionCandidateDiag["runtimeExecutionCandidatePreconditions"];
  runtimeExecutionCandidateBlockers: SerializedRuntimeExecutionCandidateDiag["runtimeExecutionCandidateBlockers"];
  runtimeOperatorApprovalSummary: SerializedRuntimeOperatorApprovalDiag["runtimeOperatorApprovalSummary"];
  runtimeRollbackReadinessSummary: SerializedRuntimeOperatorApprovalDiag["runtimeRollbackReadinessSummary"];
  runtimeAuditReadinessSummary: SerializedRuntimeOperatorApprovalDiag["runtimeAuditReadinessSummary"];
  runtimePilotPreconditionSummary: SerializedRuntimeOperatorApprovalDiag["runtimePilotPreconditionSummary"];
  runtimeControlledPilotSummary: SerializedRuntimeControlledPilotDiag["runtimeControlledPilotSummary"];
  runtimeControlledPilotSafetyEnvelope: SerializedRuntimeControlledPilotDiag["runtimeControlledPilotSafetyEnvelope"];
  runtimeControlledPilotFallbackPlan: SerializedRuntimeControlledPilotDiag["runtimeControlledPilotFallbackPlan"];
  runtimeControlledPilotAbortConditions: SerializedRuntimeControlledPilotDiag["runtimeControlledPilotAbortConditions"];
  runtimePilotContractSummary: SerializedRuntimePilotContractDiag["runtimePilotContractSummary"];
  runtimePilotContractInputSchema: SerializedRuntimePilotContractDiag["runtimePilotContractInputSchema"];
  runtimePilotContractOutputSchema: SerializedRuntimePilotContractDiag["runtimePilotContractOutputSchema"];
  runtimeAdapterBoundarySummary: SerializedRuntimePilotContractDiag["runtimeAdapterBoundarySummary"];
  runtimeAdapterForbiddenOperationReport: SerializedRuntimePilotContractDiag["runtimeAdapterForbiddenOperationReport"];
  runtimePilotHandoffReadiness: SerializedRuntimePilotContractDiag["runtimePilotHandoffReadiness"];
  runtimeNoopAdapterSummary: SerializedRuntimeNoopAdapterDiag["runtimeNoopAdapterSummary"];
  runtimeNoopAdapterSkeleton: SerializedRuntimeNoopAdapterDiag["runtimeNoopAdapterSkeleton"];
  runtimePilotContractVerificationReport: SerializedRuntimeNoopAdapterDiag["runtimePilotContractVerificationReport"];
  runtimeNoopAdapterResultMetadata: SerializedRuntimeNoopAdapterDiag["runtimeNoopAdapterResultMetadata"];
  runtimeAdapterInvocationGuardReport: SerializedRuntimeNoopAdapterDiag["runtimeAdapterInvocationGuardReport"];
  runtimeNoopAdapterBoundaryViolationReport: SerializedRuntimeNoopAdapterDiag["runtimeNoopAdapterBoundaryViolationReport"];
  runtimeNoopAdapterPreflightSummary: SerializedRuntimeNoopAdapterDiag["runtimeNoopAdapterPreflightSummary"];
  runtimeAdapterSandboxSummary: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxSummary"];
  runtimeAdapterSandboxInputEnvelope: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxInputEnvelope"];
  runtimeAdapterSandboxOutputEnvelope: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxOutputEnvelope"];
  runtimeAdapterSandboxPolicy: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxPolicy"];
  runtimeAdapterSandboxResultMetadata: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxResultMetadata"];
  runtimeAdapterSandboxBlockerReport: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxBlockerReport"];
  runtimeAdapterSandboxEnvelopeVerificationReport: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxEnvelopeVerificationReport"];
  runtimeAdapterSandboxBoundaryViolationReport: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxBoundaryViolationReport"];
  runtimeAdapterSandboxPreflightSummary: SerializedRuntimeAdapterSandboxDiag["runtimeAdapterSandboxPreflightSummary"];
  runtimePilotActivationSummary: SerializedRuntimePilotActivationDiag["runtimePilotActivationSummary"];
  runtimePilotActivationScope: SerializedRuntimePilotActivationDiag["runtimePilotActivationScope"];
  runtimePilotActivationPolicy: SerializedRuntimePilotActivationDiag["runtimePilotActivationPolicy"];
  runtimePilotActivationBlockerReport: SerializedRuntimePilotActivationDiag["runtimePilotActivationBlockerReport"];
  runtimePilotActivationReadinessChecklist: SerializedRuntimePilotActivationDiag["runtimePilotActivationReadinessChecklist"];
  runtimePilotActivationFinalSafetyGate: SerializedRuntimePilotActivationDiag["runtimePilotActivationFinalSafetyGate"];
  runtimePilotActivationBoundaryViolationReport: SerializedRuntimePilotActivationDiag["runtimePilotActivationBoundaryViolationReport"];
  runtimePilotActivationReadinessVerificationReport: SerializedRuntimePilotActivationDiag["runtimePilotActivationReadinessVerificationReport"];
  runtimePilotSkeletonSummary: SerializedRuntimePilotSkeletonDiag["runtimePilotSkeletonSummary"];
  runtimeDryRunRunnerContract: SerializedRuntimePilotSkeletonDiag["runtimeDryRunRunnerContract"];
  runtimePilotRunnerInputEnvelope: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerInputEnvelope"];
  runtimePilotRunnerOutputEnvelope: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerOutputEnvelope"];
  runtimePilotRunnerSafetyGuard: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerSafetyGuard"];
  runtimePilotSkeletonBlockerReport: SerializedRuntimePilotSkeletonDiag["runtimePilotSkeletonBlockerReport"];
  runtimePilotRunnerContractVerificationReport: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerContractVerificationReport"];
  runtimePilotRunnerBoundaryViolationReport: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerBoundaryViolationReport"];
  runtimePilotRunnerNoExecutionResultMetadata: SerializedRuntimePilotSkeletonDiag["runtimePilotRunnerNoExecutionResultMetadata"];
  runtimePilotSkeletonPreflightSummary: SerializedRuntimePilotSkeletonDiag["runtimePilotSkeletonPreflightSummary"];
  runtimeRunnerInvocationSummary: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationSummary"];
  runtimeRunnerInvocationScope: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationScope"];
  runtimeRunnerInvocationPolicy: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationPolicy"];
  runtimeRunnerInvocationBlockerReport: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationBlockerReport"];
  runtimeRunnerInvocationReadinessChecklist: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationReadinessChecklist"];
  runtimeRunnerInvocationFinalSafetyGate: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationFinalSafetyGate"];
  runtimeRunnerInvocationBoundaryViolationReport: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationBoundaryViolationReport"];
  runtimeRunnerInvocationReadinessVerificationReport: SerializedRuntimeRunnerInvocationDiag["runtimeRunnerInvocationReadinessVerificationReport"];
}> {
  const governanceDiag = serializeRuntimeResourceGovernanceDiagnosticBundleFromSemanticReports(reports);
  const allocationDiag = serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports(reports);
  const trialDiag = serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports(reports);
  const controlBoundaryDiag = serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports(reports);
  const executionCandidateDiag = serializeRuntimeExecutionCandidateDiagnosticBundleFromSemanticReports(reports);
  const operatorApprovalDiag = serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports(reports);
  const controlledPilotDiag = serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports(reports);
  const pilotContractDiag = serializeRuntimePilotContractDiagnosticBundleFromSemanticReports(reports);
  const noopAdapterDiag = serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports(reports);
  const adapterSandboxDiag = serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports(reports);
  const pilotActivationDiag = serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports(reports);
  const pilotSkeletonDiag = serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports(reports);
  const runnerInvocationDiag = serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports(reports);
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
    ...controlBoundaryDiag,
    ...executionCandidateDiag,
    ...operatorApprovalDiag,
    ...controlledPilotDiag,
    ...pilotContractDiag,
    ...noopAdapterDiag,
    ...adapterSandboxDiag,
    ...pilotActivationDiag,
    ...pilotSkeletonDiag,
    ...runnerInvocationDiag,
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
