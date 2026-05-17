/**
 * H17–H24 — semantic planning report **단계 타입**(빌더 간 순환 참조 방지).
 */

import type { RuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/runtimeControlBoundaryTypes";
import type { RuntimeExecutionCandidatePlanningReports } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateTypes";
import type { RuntimeOperatorApprovalPlanningReports } from "@/lib/harness/runtimeOperatorApproval/runtimeOperatorApprovalTypes";
import type { RuntimeControlledPilotPlanningReports } from "@/lib/harness/runtimeControlledPilot/runtimeControlledPilotTypes";
import type { RuntimePilotContractPlanningReports } from "@/lib/harness/runtimePilotContract/runtimePilotContractTypes";
import type { RuntimeNoopAdapterPlanningReports } from "@/lib/harness/runtimeNoopAdapter/runtimeNoopAdapterTypes";
import type { RuntimeAdapterSandboxPlanningReports } from "@/lib/harness/runtimeAdapterSandbox/runtimeAdapterSandboxTypes";
import type { RuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/runtimePilotActivationTypes";
import type { RuntimePilotSkeletonPlanningReports } from "@/lib/harness/runtimePilotSkeleton/runtimePilotSkeletonTypes";
import type { RuntimeRunnerInvocationPlanningReports } from "@/lib/harness/runtimeRunnerInvocation/runtimeRunnerInvocationTypes";
import type { RuntimeRunnerNoopHarnessPlanningReports } from "@/lib/harness/runtimeRunnerNoopHarness/runtimeRunnerNoopHarnessTypes";
import type { RuntimeNoopExecutionShellPlanningReports } from "@/lib/harness/runtimeNoopExecutionShell/runtimeNoopExecutionShellTypes";
import type { RuntimeNoopExecutionShellHarnessPlanningReports } from "@/lib/harness/runtimeNoopExecutionShellHarness/runtimeNoopExecutionShellHarnessTypes";
import type { RuntimeNoopShellHardeningPlanningReports } from "@/lib/harness/runtimeNoopShellHardening/runtimeNoopShellHardeningTypes";
import type { RuntimeNoopShellReleaseGatePlanningReports } from "@/lib/harness/runtimeNoopShellReleaseGate/runtimeNoopShellReleaseGateTypes";
import type { RuntimeReleaseGatePreflightPlanningReports } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightTypes";
import type { RuntimeExecutionBoundaryShellPlanningReports } from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellTypes";
import type { RuntimeExecutionGovernanceBoundaryPlanningReports } from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryTypes";
import type { RuntimeGovernanceReleaseReadinessPlanningReports } from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessTypes";
import type { RuntimeFinalReleaseGovernanceGatePlanningReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateTypes";
import type { RuntimeControlledActivationCandidatePlanningReports } from "@/lib/harness/runtimeControlledActivationCandidate/runtimeControlledActivationCandidateTypes";
import type { RuntimeLimitedPilotBoundaryPlanningReports } from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryTypes";
import type { RuntimeUltimateGovernanceReviewPlanningReports } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewTypes";

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

/** H23.5 포함·H24 직전(operator approval·rollback·audit·pilot precondition까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforeControlledPilot = RuntimeSemanticPlanningReportsBeforeOperatorApproval &
  RuntimeOperatorApprovalPlanningReports;

/** H24 포함·H24.5 직전(controlled pilot까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforePilotContract = RuntimeSemanticPlanningReportsBeforeControlledPilot &
  RuntimeControlledPilotPlanningReports;

/** H24.5 포함·H25 직전(pilot contract까지 산출된 상태). */
export type RuntimeSemanticPlanningReportsBeforeNoopAdapter = RuntimeSemanticPlanningReportsBeforePilotContract &
  RuntimePilotContractPlanningReports;

/** H25 포함 — no-op adapter skeleton·contract verification까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeAdapterSandbox = RuntimeSemanticPlanningReportsBeforeNoopAdapter &
  RuntimeNoopAdapterPlanningReports;

/** H26 포함 — adapter sandbox readiness·envelope까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforePilotActivation = RuntimeSemanticPlanningReportsBeforeAdapterSandbox &
  RuntimeAdapterSandboxPlanningReports;

/** H27 포함 — pilot activation candidate metadata까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforePilotSkeleton = RuntimeSemanticPlanningReportsBeforePilotActivation &
  RuntimePilotActivationPlanningReports;

/** H28 포함 — pilot skeleton·dry-run runner contract까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeRunnerInvocation = RuntimeSemanticPlanningReportsBeforePilotSkeleton &
  RuntimePilotSkeletonPlanningReports;

/** H29 포함 — runner invocation candidate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness =
  RuntimeSemanticPlanningReportsBeforeRunnerInvocation & RuntimeRunnerInvocationPlanningReports;

/** H30 포함 — runner no-op harness까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeNoopExecutionShell =
  RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness & RuntimeRunnerNoopHarnessPlanningReports;

/** H31 포함 — no-op execution shell candidate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness =
  RuntimeSemanticPlanningReportsBeforeNoopExecutionShell & RuntimeNoopExecutionShellPlanningReports;

/** H32 포함 — controlled execution shell harness까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeNoopShellHardening =
  RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness & RuntimeNoopExecutionShellHarnessPlanningReports;

/** H33 포함 — no-op shell hardening·contract verification까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate =
  RuntimeSemanticPlanningReportsBeforeNoopShellHardening & RuntimeNoopShellHardeningPlanningReports;

/** H34 / H34.5 포함 — release-gate final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight =
  RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate & RuntimeNoopShellReleaseGatePlanningReports;

/** H35 / H35.5 포함 — release-gate final preflight까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell =
  RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight & RuntimeReleaseGatePreflightPlanningReports;

/** H36 / H36.5 포함 — execution boundary shell final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary =
  RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell & RuntimeExecutionBoundaryShellPlanningReports;

/** H37 / H37.5 포함 — governance boundary final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness =
  RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary &
    RuntimeExecutionGovernanceBoundaryPlanningReports;

/** H38 / H38.5 포함 — governance release-readiness final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate =
  RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness &
    RuntimeGovernanceReleaseReadinessPlanningReports;

/** H39 / H39.5 포함 — final release governance gate final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview =
  RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate &
    RuntimeFinalReleaseGovernanceGatePlanningReports;

/** H40 / H40.5 포함 — ultimate governance review final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate =
  RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview &
    RuntimeUltimateGovernanceReviewPlanningReports;

/** H41 / H41.5 포함 — controlled activation candidate·final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary =
  RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate &
    RuntimeControlledActivationCandidatePlanningReports;

/** H42 / H42.5 포함 — limited pilot boundary candidate·final safety gate까지 산출된 상태. */
export type RuntimeSemanticPlanningReports = RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary &
  RuntimeLimitedPilotBoundaryPlanningReports;
