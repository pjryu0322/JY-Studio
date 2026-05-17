"use client";

import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import type { HarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import type { RecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import type { OverlayAudienceMode } from "@/lib/overlay-ui/overlayAudienceTypes";
import { buildOverlayOperatorRuntimeSummaryVm } from "@/lib/overlay-ui/overlayOperatorRuntimeSummaryAdapter";
import { buildOverlayOperatorResourceSummaryVm } from "@/lib/overlay-ui/overlayOperatorResourceSummaryAdapter";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import { buildOverlayResourceOrchestrationSectionVm } from "@/lib/overlay-ui/overlayResourceOrchestrationAdapter";
import { buildOverlayRuntimeTrialSectionVm } from "@/lib/overlay-ui/overlayRuntimeTrialAdapter";
import { buildOverlayRuntimeGovernanceSectionVm } from "@/lib/overlay-ui/overlayRuntimeGovernanceAdapter";
import { buildOverlayRuntimeEnforcementCandidateSectionVm } from "@/lib/overlay-ui/overlayRuntimeEnforcementCandidateAdapter";
import { buildOverlayControlledEnforcementGovernanceSectionVm } from "@/lib/overlay-ui/overlayControlledEnforcementGovernanceAdapter";
import { buildOverlayRuntimePlanningSectionVms } from "@/lib/overlay-ui/overlayRuntimePlanningSectionVms";
import { OverlayRuntimeStabilitySection } from "./OverlayRuntimeStabilitySection";
import { OverlayRuntimePrioritySection } from "./OverlayRuntimePrioritySection";
import { OverlaySaturationBanner } from "./OverlaySaturationBanner";
import { OverlayEscalationBadge } from "./OverlayEscalationBadge";
import { OverlayRuntimeLifecycleSection } from "./OverlayRuntimeLifecycleSection";
import { OverlayRuntimePlanningConsolidatedSection } from "./OverlayRuntimePlanningConsolidatedSection";
import { OverlayRuntimeLifecycleCoherenceGroup } from "./OverlayRuntimeLifecycleCoherenceGroup";
import { OverlayRuntimeDependencyCriticalityGroup } from "./OverlayRuntimeDependencyCriticalityGroup";
import { resolveOverlaySectionUiPolicy } from "@/lib/overlay-ui/overlaySectionOpenPolicy";
import type { OverlaySectionKind } from "@/lib/overlay-ui/overlaySectionPriority";
import {
  OVERLAY_UI_EMPTY_STATE_HINT,
  OVERLAY_UI_EMPTY_STATE_MESSAGE,
} from "@/lib/overlay-ui/overlayUiDescription";
import { clipWithHiddenCount, OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS } from "@/lib/overlay-ui/overlayRenderingBudget";
import { OverlayContextSection } from "./OverlayContextSection";
import { OverlayBudgetSection } from "./OverlayBudgetSection";
import { OverlayResourceOrchestrationSection } from "./OverlayResourceOrchestrationSection";
import { OverlayWarningSection } from "./OverlayWarningSection";
import { OverlayAssemblyPlanSection } from "./OverlayAssemblyPlanSection";
import { OverlayPruningSection } from "./OverlayPruningSection";
import { OverlayHarnessPromptPreviewSection } from "./OverlayHarnessPromptPreviewSection";
import { OverlayKnowledgeActivationSection } from "./OverlayKnowledgeActivationSection";
import { OverlayMemoryRuntimeSection } from "./OverlayMemoryRuntimeSection";
import { OverlayExecutionRoutingSection } from "./OverlayExecutionRoutingSection";
import { OverlayReviewSecuritySection } from "./OverlayReviewSecuritySection";
import { OverlayReviewSecurityIssueSection } from "./OverlayReviewSecurityIssueSection";
import { OverlayRemediationLoopSection } from "./OverlayRemediationLoopSection";
import { OverlayHarnessMaturitySection } from "./OverlayHarnessMaturitySection";
import { OverlayRuntimeTrialSection } from "./OverlayRuntimeTrialSection";
import { OverlayRuntimeGovernanceSection } from "./OverlayRuntimeGovernanceSection";
import { OverlayRuntimeEnforcementCandidateSection } from "./OverlayRuntimeEnforcementCandidateSection";
import { OverlayControlledEnforcementGovernanceSection } from "./OverlayControlledEnforcementGovernanceSection";
import { OverlayOperatorRuntimeSummary } from "./OverlayOperatorRuntimeSummary";
import { OverlayOperatorResourceSummary } from "./OverlayOperatorResourceSummary";
import { OverlaySummaryHeader } from "./OverlaySummaryHeader";
import { OverlayUiEmptyHint } from "./OverlayUiPrimitives";

/**
 * Overlay 탭 진입점 카드.
 *
 * - H8.5: `compactMode`·`isNarrow`·`overlayAudienceMode`로 섹션 과밀·노출 대상을 완화한다.
 * - 섹션 기본 펼침은 `overlayUiAdapter.sectionDefaults`를 입력으로 `resolveOverlaySectionUiPolicy`가 조정한다.
 */
export function OverlaySummaryCard({
  overlay,
  harnessPromptApplyReadinessReport,
  recentMemoryRuntimeSummary,
  messageExplainabilityAvailable = true,
  harnessMaturityBaselineReport: maturityBaselineOverride,
  harnessReleaseGateReadinessReport: releaseGateOverride,
  compactMode = false,
  isNarrow = false,
  overlayAudienceMode = "operator",
}: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly harnessPromptApplyReadinessReport?: HarnessPromptApplyReadinessReport | null;
  readonly recentMemoryRuntimeSummary?: RecentMemoryRuntimeSummary | null;
  readonly messageExplainabilityAvailable?: boolean;
  readonly harnessMaturityBaselineReport?: HarnessMaturityBaselineReport | null;
  readonly harnessReleaseGateReadinessReport?: HarnessReleaseGateReadinessReport | null;
  /** H8.5 — narrow+compact에서 advanced 섹션 DOM 생략 등에 사용 */
  readonly compactMode?: boolean;
  readonly isNarrow?: boolean;
  readonly overlayAudienceMode?: OverlayAudienceMode;
}) {
  const vm = buildOverlayUiViewModel(overlay);
  const maturityBaseline =
    maturityBaselineOverride ??
    evaluateHarnessMaturityBaseline({
      overlayExtract: overlay ?? null,
      harnessPromptApplyReadinessReport: harnessPromptApplyReadinessReport ?? null,
      recentMemoryRuntimeSummary: recentMemoryRuntimeSummary ?? null,
      messageExplainabilityAvailable,
    });
  const releaseGate = releaseGateOverride ?? evaluateHarnessReleaseGateReadiness(maturityBaseline);
  if (!vm.hasOverlayData) {
    return (
      <OverlayUiEmptyHint
        message={OVERLAY_UI_EMPTY_STATE_MESSAGE}
        secondary={OVERLAY_UI_EMPTY_STATE_HINT}
      />
    );
  }

  const audience: OverlayAudienceMode = overlayAudienceMode;
  const d = vm.sectionDefaults;

  const pol = (kind: OverlaySectionKind, baseOpen: boolean) =>
    resolveOverlaySectionUiPolicy({
      section: kind,
      baseDefaultOpen: baseOpen,
      compactMode,
      isNarrow,
      audience,
    });

  const operatorVm = buildOverlayOperatorRuntimeSummaryVm({
    overlay,
    summary: vm.summary,
    maturityBaseline,
    releaseGate,
    messageExplainabilityAvailable,
  });
  const compactAndNarrowUi = compactMode && isNarrow;
  const operatorResourceVm = buildOverlayOperatorResourceSummaryVm({
    overlay,
    summary: vm.summary,
    compactAndNarrowUi,
  });
  const resourceOrchVm = buildOverlayResourceOrchestrationSectionVm(overlay);
  const runtimeTrialVm = buildOverlayRuntimeTrialSectionVm({
    overlay,
    maturityBaseline,
    releaseGate,
  });
  const runtimeGovernanceVm = buildOverlayRuntimeGovernanceSectionVm({
    overlay,
    maturityBaseline,
    releaseGate,
  });
  const runtimeEnforcementVm = buildOverlayRuntimeEnforcementCandidateSectionVm({
    overlay,
    maturityBaseline,
    releaseGate,
    messageExplainabilityAvailable,
    overlayWarningCount: vm.summary.warningCount,
  });
  const controlledEnforcementGovVm = buildOverlayControlledEnforcementGovernanceSectionVm({
    overlay,
    maturityBaseline,
    releaseGate,
    messageExplainabilityAvailable,
    overlayWarningCount: vm.summary.warningCount,
  });
  const {
    stabilityVm: runtimeStabilityVm,
    priorityVm: runtimePriorityVm,
    lifecycleVm: runtimeLifecycleVm,
    coherenceVm: runtimeCoherenceVm,
    consolidatedVm: runtimePlanningConsolidatedVm,
    dependencyGraphVm: runtimePlanningDependencyVm,
    criticalityVm: runtimePlanningCriticalityVm,
    traceabilityVm: runtimePlanningTraceabilityVm,
    reasoningVm: runtimePlanningReasoningVm,
    semanticVm: runtimePlanningSemanticVm,
    semanticGraphVm: runtimePlanningSemanticGraphVm,
    semanticNarrativeVm: runtimePlanningSemanticNarrativeVm,
    semanticVocabularyVm: runtimePlanningSemanticVocabularyVm,
    decisionVm: runtimePlanningDecisionVm,
    forecastVm: runtimePlanningForecastVm,
    resourceVm: runtimePlanningResourceVm,
    resourceGovernanceVm: runtimePlanningResourceGovernanceVm,
    resourceAllocationVm: runtimePlanningResourceAllocationVm,
    resourceTrialVm: runtimePlanningResourceTrialVm,
    runtimeControlBoundaryVm: runtimePlanningControlBoundaryVm,
    runtimeExecutionCandidateVm: runtimePlanningExecutionCandidateVm,
    runtimeOperatorApprovalVm: runtimePlanningOperatorApprovalVm,
    runtimeControlledPilotVm: runtimePlanningControlledPilotVm,
    runtimePilotContractVm: runtimePlanningPilotContractVm,
    runtimeNoopAdapterVm: runtimePlanningNoopAdapterVm,
    runtimeAdapterSandboxVm: runtimePlanningAdapterSandboxVm,
    runtimePilotActivationVm: runtimePlanningPilotActivationVm,
    runtimePilotSkeletonVm: runtimePlanningPilotSkeletonVm,
    runtimeRunnerInvocationVm: runtimePlanningRunnerInvocationVm,
    runtimeRunnerNoopHarnessVm: runtimePlanningRunnerNoopHarnessVm,
    runtimeNoopExecutionShellVm: runtimePlanningNoopExecutionShellVm,
    runtimeNoopExecutionShellHarnessVm: runtimePlanningNoopExecutionShellHarnessVm,
    runtimeNoopShellHardeningVm: runtimePlanningNoopShellHardeningVm,
    runtimeNoopShellReleaseGateVm: runtimePlanningNoopShellReleaseGateVm,
    runtimeReleaseGatePreflightVm: runtimePlanningReleaseGatePreflightVm,
    runtimeExecutionBoundaryShellVm: runtimePlanningExecutionBoundaryShellVm,
    runtimeExecutionGovernanceBoundaryVm: runtimePlanningExecutionGovernanceBoundaryVm,
    runtimeGovernanceReleaseReadinessVm: runtimePlanningGovernanceReleaseReadinessVm,
    runtimeFinalReleaseGovernanceGateVm: runtimePlanningFinalReleaseGovernanceGateVm,
    runtimeUltimateGovernanceReviewVm: runtimePlanningUltimateGovernanceReviewVm,
    runtimeControlledActivationCandidateVm: runtimePlanningControlledActivationCandidateVm,
    runtimeLimitedPilotBoundaryVm: runtimePlanningLimitedPilotBoundaryVm,
    runtimeLimitedPilotReadinessReviewVm: runtimePlanningLimitedPilotReadinessReviewVm,
    runtimePilotExecutionReadinessVm: runtimePlanningPilotExecutionReadinessVm,
  } = buildOverlayRuntimePlanningSectionVms({
      overlay,
      maturityBaseline,
      releaseGate,
      messageExplainabilityAvailable,
      overlayWarningCount: vm.summary.warningCount,
      compactAndNarrowUi,
    });

  const advancedMeta: readonly { kind: OverlaySectionKind; base: boolean }[] = [
    { kind: "review_security", base: d.reviewSecurity },
    { kind: "review_security_issue", base: d.reviewSecurityIssue },
    { kind: "remediation_loop", base: d.remediationLoop },
    { kind: "assembly_plan", base: d.assemblyPlan },
    { kind: "pruning", base: d.pruning },
    { kind: "harness_prompt_preview", base: d.harnessPromptPreview },
  ];
  const advancedPolicies = advancedMeta.map(({ kind, base }) => ({
    kind,
    policy: pol(kind, base),
  }));
  const advancedVisible = advancedPolicies.filter((x) => !x.policy.omitFromDom);
  const advancedClip = compactMode
    ? clipWithHiddenCount(advancedVisible, OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS)
    : { visible: advancedVisible, hiddenCount: 0 };
  const advancedAllowed = new Set(advancedClip.visible.map((x) => x.kind));

  const showAdvanced = (kind: OverlaySectionKind) => advancedAllowed.has(kind);

  const pOp = pol("operator_runtime_summary", d.operatorRuntimeSummary);
  const pOpRes = pol("operator_resource_summary", d.operatorResourceSummary);
  const pCtx = pol("context", d.context);
  const pBud = pol("budget", d.budget);
  const pRes = pol("resource_orchestration", d.resourceOrchestration);
  const pWar = pol("warning", d.warning);
  const pEx = pol("execution_routing", d.executionRouting);
  const pMat = pol("maturity_baseline", d.harnessMaturity);
  const pRt = pol("runtime_trial", d.runtimeTrial);
  const pGov = pol("runtime_governance", d.runtimeGovernance);
  const pEnf = pol("runtime_enforcement_candidate", d.runtimeEnforcementCandidate);
  const pCEg = pol("controlled_enforcement_governance", d.controlledEnforcementGovernance);
  const pStab = pol("runtime_stability", d.runtimeStability || runtimeStabilityVm.showSaturationBanner);
  const pPri = pol(
    "runtime_priority",
    d.runtimePriority || runtimePriorityVm.showEscalationBadge || runtimePriorityVm.operatorAttentionRequired
  );
  const pLife = pol(
    "runtime_lifecycle",
    d.runtimeLifecycle ||
      runtimeLifecycleVm.showStaleLifecycleBanner ||
      runtimeLifecycleVm.lifecycleStateLabel === "무효화 후보"
  );
  const pCoh = pol(
    "runtime_coherence",
    d.runtimeCoherence || runtimeCoherenceVm.operatorAttentionRequired
  );
  const pCon = pol(
    "runtime_planning_consolidated",
    d.runtimePlanningConsolidated || runtimePlanningConsolidatedVm.showAttention
  );
  const pDep = pol(
    "runtime_planning_dependency",
    d.runtimePlanningDependency || runtimePlanningDependencyVm.showAttention
  );
  const pCrit = pol(
    "runtime_planning_criticality",
    d.runtimePlanningCriticality || runtimePlanningCriticalityVm.showAttention
  );
  const showLifecycleCoherenceGrouped = !pLife.omitFromDom || !pCoh.omitFromDom;
  const pTrace = pol(
    "runtime_planning_traceability",
    d.runtimePlanningTraceability || runtimePlanningTraceabilityVm.showAttention
  );
  const pReason = pol(
    "runtime_planning_reasoning",
    d.runtimePlanningReasoning || runtimePlanningReasoningVm.showAttention
  );
  const pSemantic = pol(
    "runtime_planning_semantic",
    d.runtimePlanningSemantic || runtimePlanningSemanticVm.showAttention
  );
  const pSemanticGraph = pol(
    "runtime_planning_semantic_graph",
    d.runtimePlanningSemanticGraph || runtimePlanningSemanticGraphVm.showAttention
  );
  const pSemanticNarrative = pol(
    "runtime_planning_semantic_narrative",
    d.runtimePlanningSemanticNarrative || runtimePlanningSemanticNarrativeVm.showAttention
  );
  const pSemanticVocabulary = pol(
    "runtime_planning_semantic_vocabulary",
    d.runtimePlanningSemanticVocabulary || runtimePlanningSemanticVocabularyVm.showAttention
  );
  const pDecision = pol(
    "runtime_planning_decision",
    d.runtimePlanningDecision || runtimePlanningDecisionVm.showAttention
  );
  const pForecast = pol(
    "runtime_planning_forecast",
    d.runtimePlanningForecast || runtimePlanningForecastVm.showAttention
  );
  const pResource = pol(
    "runtime_planning_resource",
    d.runtimePlanningResource || runtimePlanningResourceVm.showAttention
  );
  const pResourceGov = pol(
    "runtime_planning_resource_governance",
    d.runtimePlanningResourceGovernance || runtimePlanningResourceGovernanceVm.showAttention
  );
  const pResourceAlloc = pol(
    "runtime_planning_resource_allocation",
    d.runtimePlanningResourceAllocation || runtimePlanningResourceAllocationVm.showAttention
  );
  const pResourceTrial = pol(
    "runtime_planning_resource_trial",
    d.runtimePlanningResourceTrial || runtimePlanningResourceTrialVm.showAttention
  );
  const pControlBoundary = pol(
    "runtime_planning_control_boundary",
    d.runtimePlanningControlBoundary || runtimePlanningControlBoundaryVm.showAttention
  );
  const pExecutionCandidate = pol(
    "runtime_planning_execution_candidate",
    d.runtimePlanningExecutionCandidate || runtimePlanningExecutionCandidateVm.showAttention
  );
  const pOperatorApproval = pol(
    "runtime_planning_operator_approval_readiness",
    d.runtimePlanningOperatorApprovalReadiness || runtimePlanningOperatorApprovalVm.showAttention
  );
  const pControlledPilot = pol(
    "runtime_planning_controlled_runtime_pilot",
    d.runtimePlanningControlledRuntimePilot || runtimePlanningControlledPilotVm.showAttention
  );
  const pPilotContract = pol(
    "runtime_planning_pilot_contract_adapter_boundary",
    d.runtimePlanningPilotContractAdapterBoundary || runtimePlanningPilotContractVm.showAttention
  );
  const pNoopAdapter = pol(
    "runtime_planning_noop_runtime_adapter",
    d.runtimePlanningNoopRuntimeAdapter || runtimePlanningNoopAdapterVm.showAttention
  );
  const pAdapterSandbox = pol(
    "runtime_planning_runtime_adapter_sandbox",
    d.runtimePlanningRuntimeAdapterSandbox || runtimePlanningAdapterSandboxVm.showAttention
  );
  const pPilotActivation = pol(
    "runtime_planning_runtime_pilot_activation",
    d.runtimePlanningRuntimePilotActivation || runtimePlanningPilotActivationVm.showAttention
  );
  const pPilotSkeleton = pol(
    "runtime_planning_runtime_pilot_skeleton",
    d.runtimePlanningRuntimePilotSkeleton || runtimePlanningPilotSkeletonVm.showAttention
  );
  const pRunnerInvocation = pol(
    "runtime_planning_runtime_runner_invocation",
    d.runtimePlanningRuntimeRunnerInvocation || runtimePlanningRunnerInvocationVm.showAttention
  );
  const pRunnerNoopHarness = pol(
    "runtime_planning_runtime_runner_noop_harness",
    d.runtimePlanningRuntimeRunnerNoopHarness || runtimePlanningRunnerNoopHarnessVm.showAttention
  );
  const pNoopExecutionShell = pol(
    "runtime_planning_runtime_noop_execution_shell",
    d.runtimePlanningRuntimeNoopExecutionShell || runtimePlanningNoopExecutionShellVm.showAttention
  );
  const pNoopExecutionShellHarness = pol(
    "runtime_planning_runtime_noop_execution_shell_harness",
    d.runtimePlanningRuntimeNoopExecutionShellHarness || runtimePlanningNoopExecutionShellHarnessVm.showAttention
  );
  const pNoopShellHardening = pol(
    "runtime_planning_runtime_noop_shell_hardening",
    d.runtimePlanningRuntimeNoopShellHardening || runtimePlanningNoopShellHardeningVm.showAttention
  );
  const pNoopShellReleaseGate = pol(
    "runtime_planning_runtime_noop_shell_release_gate",
    d.runtimePlanningRuntimeNoopShellReleaseGate || runtimePlanningNoopShellReleaseGateVm.showAttention
  );
  const pReleaseGatePreflight = pol(
    "runtime_planning_runtime_release_gate_preflight",
    d.runtimePlanningRuntimeReleaseGatePreflight || runtimePlanningReleaseGatePreflightVm.showAttention
  );
  const pExecutionBoundaryShell = pol(
    "runtime_planning_runtime_execution_boundary_shell",
    d.runtimePlanningRuntimeExecutionBoundaryShell || runtimePlanningExecutionBoundaryShellVm.showAttention
  );
  const pExecutionGovernanceBoundary = pol(
    "runtime_planning_runtime_execution_governance_boundary",
    d.runtimePlanningRuntimeExecutionGovernanceBoundary ||
      runtimePlanningExecutionGovernanceBoundaryVm.showAttention
  );
  const pGovernanceReleaseReadiness = pol(
    "runtime_planning_runtime_governance_release_readiness",
    d.runtimePlanningRuntimeGovernanceReleaseReadiness ||
      runtimePlanningGovernanceReleaseReadinessVm.showAttention
  );
  const pFinalReleaseGovernanceGate = pol(
    "runtime_planning_runtime_final_release_governance_gate",
    d.runtimePlanningRuntimeFinalReleaseGovernanceGate ||
      runtimePlanningFinalReleaseGovernanceGateVm.showAttention
  );
  const pUltimateGovernanceReview = pol(
    "runtime_planning_runtime_ultimate_governance_review",
    d.runtimePlanningRuntimeUltimateGovernanceReview ||
      runtimePlanningUltimateGovernanceReviewVm.showAttention
  );
  const pControlledActivationCandidate = pol(
    "runtime_planning_runtime_controlled_activation_candidate",
    d.runtimePlanningRuntimeControlledActivationCandidate ||
      runtimePlanningControlledActivationCandidateVm.showAttention
  );
  const pLimitedPilotBoundary = pol(
    "runtime_planning_runtime_limited_pilot_boundary",
    d.runtimePlanningRuntimeLimitedPilotBoundary || runtimePlanningLimitedPilotBoundaryVm.showAttention
  );
  const pLimitedPilotReadinessReview = pol(
    "runtime_planning_runtime_limited_pilot_readiness_review",
    d.runtimePlanningRuntimeLimitedPilotReadinessReview ||
      runtimePlanningLimitedPilotReadinessReviewVm.showAttention
  );
  const pPilotExecutionReadiness = pol(
    "runtime_planning_runtime_pilot_execution_readiness",
    d.runtimePlanningRuntimePilotExecutionReadiness || runtimePlanningPilotExecutionReadinessVm.showAttention
  );
  /** H20.5 resource → H35 release-gate preflight까지 DOM에서 생략된 경우에만 상위(forecast·semantic…) 표시. */
  const resourceThroughNoopExecutionShellOmitted =
    pResource.omitFromDom &&
    pResourceGov.omitFromDom &&
    pResourceAlloc.omitFromDom &&
    pResourceTrial.omitFromDom &&
    pControlBoundary.omitFromDom &&
    pExecutionCandidate.omitFromDom &&
    pOperatorApproval.omitFromDom &&
    pControlledPilot.omitFromDom &&
    pPilotContract.omitFromDom &&
    pNoopAdapter.omitFromDom &&
    pAdapterSandbox.omitFromDom &&
    pPilotActivation.omitFromDom &&
    pPilotSkeleton.omitFromDom &&
    pRunnerInvocation.omitFromDom &&
    pRunnerNoopHarness.omitFromDom &&
    pNoopExecutionShell.omitFromDom &&
    pNoopExecutionShellHarness.omitFromDom &&
    pNoopShellHardening.omitFromDom &&
    pNoopShellReleaseGate.omitFromDom &&
    pReleaseGatePreflight.omitFromDom &&
    pExecutionBoundaryShell.omitFromDom &&
    pExecutionGovernanceBoundary.omitFromDom &&
    pGovernanceReleaseReadiness.omitFromDom &&
    pFinalReleaseGovernanceGate.omitFromDom &&
    pUltimateGovernanceReview.omitFromDom &&
    pControlledActivationCandidate.omitFromDom &&
    pLimitedPilotBoundary.omitFromDom &&
    pLimitedPilotReadinessReview.omitFromDom &&
    pPilotExecutionReadiness.omitFromDom;
  const showDependencyCriticalityGrouped =
    !pDep.omitFromDom ||
    !pCrit.omitFromDom ||
    !pTrace.omitFromDom ||
    !pReason.omitFromDom ||
    !pSemantic.omitFromDom ||
    !pSemanticGraph.omitFromDom ||
    !pSemanticNarrative.omitFromDom ||
    !pSemanticVocabulary.omitFromDom ||
    !pDecision.omitFromDom ||
    !pForecast.omitFromDom ||
    !pResource.omitFromDom ||
    !pResourceGov.omitFromDom ||
    !pResourceAlloc.omitFromDom ||
    !pResourceTrial.omitFromDom ||
    !pControlBoundary.omitFromDom ||
    !pExecutionCandidate.omitFromDom ||
    !pOperatorApproval.omitFromDom ||
    !pControlledPilot.omitFromDom ||
    !pPilotContract.omitFromDom ||
    !pNoopAdapter.omitFromDom;
  const pKn = pol("knowledge_activation", d.knowledgeActivation);
  const pMem = pol("memory_runtime", d.memoryRuntime);
  const pRs = pol("review_security", d.reviewSecurity);
  const pRi = pol("review_security_issue", d.reviewSecurityIssue);
  const pRem = pol("remediation_loop", d.remediationLoop);
  const pAsm = pol("assembly_plan", d.assemblyPlan);
  const pPr = pol("pruning", d.pruning);
  const pH1 = pol("harness_prompt_preview", d.harnessPromptPreview);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <OverlaySummaryHeader vm={vm.summary} />
      {!pOp.omitFromDom ? (
        <OverlayOperatorRuntimeSummary vm={operatorVm} defaultOpen={pOp.defaultOpen} />
      ) : null}
      {!pOpRes.omitFromDom ? (
        <OverlayOperatorResourceSummary vm={operatorResourceVm} defaultOpen={pOpRes.defaultOpen} />
      ) : null}
      {!pCtx.omitFromDom ? <OverlayContextSection vm={vm.context} defaultOpen={pCtx.defaultOpen} /> : null}
      {!pBud.omitFromDom ? <OverlayBudgetSection vm={vm.budget} defaultOpen={pBud.defaultOpen} /> : null}
      {!pRes.omitFromDom ? (
        <OverlayResourceOrchestrationSection vm={resourceOrchVm} defaultOpen={pRes.defaultOpen} />
      ) : null}
      {!pWar.omitFromDom ? <OverlayWarningSection vm={vm.warning} defaultOpen={pWar.defaultOpen} /> : null}
      {!pAsm.omitFromDom && showAdvanced("assembly_plan") ? (
        <OverlayAssemblyPlanSection vm={vm.assemblyPlan} defaultOpen={pAsm.defaultOpen} />
      ) : null}
      {!pPr.omitFromDom && showAdvanced("pruning") ? (
        <OverlayPruningSection vm={vm.pruning} defaultOpen={pPr.defaultOpen} />
      ) : null}
      {!pH1.omitFromDom && showAdvanced("harness_prompt_preview") ? (
        <OverlayHarnessPromptPreviewSection overlay={overlay} defaultOpen={pH1.defaultOpen} />
      ) : null}
      {!pKn.omitFromDom ? (
        <OverlayKnowledgeActivationSection overlay={overlay} defaultOpen={pKn.defaultOpen} />
      ) : null}
      {!pMem.omitFromDom ? <OverlayMemoryRuntimeSection overlay={overlay} defaultOpen={pMem.defaultOpen} /> : null}
      {!pEx.omitFromDom ? (
        <OverlayExecutionRoutingSection overlay={overlay} defaultOpen={pEx.defaultOpen} />
      ) : null}
      {!pRs.omitFromDom && showAdvanced("review_security") ? (
        <OverlayReviewSecuritySection overlay={overlay} defaultOpen={pRs.defaultOpen} />
      ) : null}
      {!pRi.omitFromDom && showAdvanced("review_security_issue") ? (
        <OverlayReviewSecurityIssueSection overlay={overlay} defaultOpen={pRi.defaultOpen} />
      ) : null}
      {!pRem.omitFromDom && showAdvanced("remediation_loop") ? (
        <OverlayRemediationLoopSection overlay={overlay} defaultOpen={pRem.defaultOpen} />
      ) : null}
      {!pMat.omitFromDom ? (
        <OverlayHarnessMaturitySection
          baseline={maturityBaseline}
          releaseGate={releaseGate}
          defaultOpen={pMat.defaultOpen}
        />
      ) : null}
      {runtimeStabilityVm.showSaturationBanner && !pStab.omitFromDom ? (
        <OverlaySaturationBanner message={runtimeStabilityVm.saturationBannerMessage} />
      ) : null}
      {runtimePriorityVm.showEscalationBadge && !pPri.omitFromDom ? (
        <OverlayEscalationBadge escalationLabel={runtimePriorityVm.escalationLevelLabel} />
      ) : null}
      {!pCon.omitFromDom ? (
        <OverlayRuntimePlanningConsolidatedSection
          vm={runtimePlanningConsolidatedVm}
          defaultOpen={pCon.defaultOpen}
        />
      ) : null}
      {!pStab.omitFromDom ? (
        <OverlayRuntimeStabilitySection vm={runtimeStabilityVm} defaultOpen={pStab.defaultOpen} />
      ) : null}
      {!pPri.omitFromDom ? (
        <OverlayRuntimePrioritySection vm={runtimePriorityVm} defaultOpen={pPri.defaultOpen} />
      ) : null}
      {runtimeLifecycleVm.showStaleLifecycleBanner && showLifecycleCoherenceGrouped ? (
        <OverlaySaturationBanner message={runtimeLifecycleVm.staleLifecycleBannerMessage} />
      ) : null}
      {showLifecycleCoherenceGrouped && (!pLife.omitFromDom || !pCoh.omitFromDom) ? (
        <OverlayRuntimeLifecycleCoherenceGroup
          lifecycleVm={runtimeLifecycleVm}
          coherenceVm={runtimeCoherenceVm}
          lifecycleDefaultOpen={pLife.defaultOpen}
          coherenceDefaultOpen={pCoh.defaultOpen}
          groupOpen={!compactAndNarrowUi && (pLife.defaultOpen || pCoh.defaultOpen)}
          showLifecycle={!pLife.omitFromDom}
          showCoherence={!pCoh.omitFromDom}
        />
      ) : null}
      {showDependencyCriticalityGrouped ? (
        <OverlayRuntimeDependencyCriticalityGroup
          dependencyVm={runtimePlanningDependencyVm}
          criticalityVm={runtimePlanningCriticalityVm}
          resourceVm={runtimePlanningResourceVm}
          resourceGovernanceVm={runtimePlanningResourceGovernanceVm}
          resourceAllocationVm={runtimePlanningResourceAllocationVm}
          resourceTrialVm={runtimePlanningResourceTrialVm}
          runtimeControlBoundaryVm={runtimePlanningControlBoundaryVm}
          runtimeExecutionCandidateVm={runtimePlanningExecutionCandidateVm}
          runtimeOperatorApprovalVm={runtimePlanningOperatorApprovalVm}
          runtimeControlledPilotVm={runtimePlanningControlledPilotVm}
          runtimePilotContractVm={runtimePlanningPilotContractVm}
          runtimeNoopAdapterVm={runtimePlanningNoopAdapterVm}
          runtimeAdapterSandboxVm={runtimePlanningAdapterSandboxVm}
          runtimePilotActivationVm={runtimePlanningPilotActivationVm}
          runtimePilotSkeletonVm={runtimePlanningPilotSkeletonVm}
          runtimeRunnerInvocationVm={runtimePlanningRunnerInvocationVm}
          runtimeRunnerNoopHarnessVm={runtimePlanningRunnerNoopHarnessVm}
          runtimeNoopExecutionShellVm={runtimePlanningNoopExecutionShellVm}
          runtimeNoopExecutionShellHarnessVm={runtimePlanningNoopExecutionShellHarnessVm}
          runtimeNoopShellHardeningVm={runtimePlanningNoopShellHardeningVm}
          runtimeNoopShellReleaseGateVm={runtimePlanningNoopShellReleaseGateVm}
          runtimeReleaseGatePreflightVm={runtimePlanningReleaseGatePreflightVm}
          forecastVm={runtimePlanningForecastVm}
          decisionVm={runtimePlanningDecisionVm}
          semanticVocabularyVm={runtimePlanningSemanticVocabularyVm}
          semanticNarrativeVm={runtimePlanningSemanticNarrativeVm}
          semanticGraphVm={runtimePlanningSemanticGraphVm}
          semanticVm={runtimePlanningSemanticVm}
          reasoningVm={runtimePlanningReasoningVm}
          traceabilityVm={runtimePlanningTraceabilityVm}
          dependencyDefaultOpen={pDep.defaultOpen}
          criticalityDefaultOpen={pCrit.defaultOpen}
          resourceDefaultOpen={pResource.defaultOpen}
          resourceGovernanceDefaultOpen={pResourceGov.defaultOpen}
          resourceAllocationDefaultOpen={pResourceAlloc.defaultOpen}
          resourceTrialDefaultOpen={pResourceTrial.defaultOpen}
          controlBoundaryDefaultOpen={pControlBoundary.defaultOpen}
          executionCandidateDefaultOpen={pExecutionCandidate.defaultOpen}
          operatorApprovalDefaultOpen={pOperatorApproval.defaultOpen}
          controlledPilotDefaultOpen={pControlledPilot.defaultOpen}
          pilotContractDefaultOpen={pPilotContract.defaultOpen}
          noopAdapterDefaultOpen={pNoopAdapter.defaultOpen}
          adapterSandboxDefaultOpen={pAdapterSandbox.defaultOpen}
          pilotActivationDefaultOpen={pPilotActivation.defaultOpen}
          pilotSkeletonDefaultOpen={pPilotSkeleton.defaultOpen}
          runnerInvocationDefaultOpen={pRunnerInvocation.defaultOpen}
          runnerNoopHarnessDefaultOpen={pRunnerNoopHarness.defaultOpen}
          noopExecutionShellDefaultOpen={pNoopExecutionShell.defaultOpen}
          noopExecutionShellHarnessDefaultOpen={pNoopExecutionShellHarness.defaultOpen}
          noopShellHardeningDefaultOpen={pNoopShellHardening.defaultOpen}
          forecastDefaultOpen={pForecast.defaultOpen}
          decisionDefaultOpen={pDecision.defaultOpen}
          semanticVocabularyDefaultOpen={pSemanticVocabulary.defaultOpen}
          semanticNarrativeDefaultOpen={pSemanticNarrative.defaultOpen}
          semanticGraphDefaultOpen={pSemanticGraph.defaultOpen}
          semanticDefaultOpen={pSemantic.defaultOpen}
          reasoningDefaultOpen={pReason.defaultOpen}
          traceabilityDefaultOpen={pTrace.defaultOpen}
          groupOpen={
            !compactAndNarrowUi &&
            (pDep.defaultOpen ||
              pCrit.defaultOpen ||
              pTrace.defaultOpen ||
              pReason.defaultOpen ||
              pSemantic.defaultOpen ||
              pSemanticGraph.defaultOpen ||
              pSemanticNarrative.defaultOpen ||
              pSemanticVocabulary.defaultOpen ||
              pDecision.defaultOpen ||
              pForecast.defaultOpen ||
              pResource.defaultOpen ||
              pResourceGov.defaultOpen ||
              pResourceAlloc.defaultOpen ||
              pResourceTrial.defaultOpen ||
              pControlBoundary.defaultOpen ||
              pExecutionCandidate.defaultOpen ||
              pOperatorApproval.defaultOpen ||
              pControlledPilot.defaultOpen ||
              pPilotContract.defaultOpen)
          }
          showDependency={!pDep.omitFromDom}
          showCriticality={!pCrit.omitFromDom}
          showResource={!pResource.omitFromDom}
          showResourceGovernance={!pResourceGov.omitFromDom}
          showResourceAllocation={!pResourceAlloc.omitFromDom}
          showResourceTrial={!pResourceTrial.omitFromDom}
          showRuntimeControlBoundary={!pControlBoundary.omitFromDom}
          showRuntimeExecutionCandidate={!pExecutionCandidate.omitFromDom}
          showRuntimeOperatorApproval={!pOperatorApproval.omitFromDom}
          showRuntimeControlledPilot={!pControlledPilot.omitFromDom}
          showRuntimePilotContract={!pPilotContract.omitFromDom}
          showRuntimeNoopAdapter={!pNoopAdapter.omitFromDom}
          showRuntimeAdapterSandbox={!pAdapterSandbox.omitFromDom}
          showRuntimePilotActivation={!pPilotActivation.omitFromDom}
          showRuntimePilotSkeleton={!pPilotSkeleton.omitFromDom}
          showRuntimeRunnerInvocation={!pRunnerInvocation.omitFromDom}
          showRuntimeRunnerNoopHarness={!pRunnerNoopHarness.omitFromDom}
          showRuntimeNoopExecutionShell={!pNoopExecutionShell.omitFromDom}
          showRuntimeNoopExecutionShellHarness={!pNoopExecutionShellHarness.omitFromDom}
          showRuntimeNoopShellHardening={!pNoopShellHardening.omitFromDom}
          showRuntimeNoopShellReleaseGate={!pNoopShellReleaseGate.omitFromDom}
          showRuntimeReleaseGatePreflight={!pReleaseGatePreflight.omitFromDom}
          releaseGatePreflightDefaultOpen={pReleaseGatePreflight.defaultOpen}
          showRuntimeExecutionBoundaryShell={!pExecutionBoundaryShell.omitFromDom}
          executionBoundaryShellDefaultOpen={pExecutionBoundaryShell.defaultOpen}
          runtimeExecutionBoundaryShellVm={runtimePlanningExecutionBoundaryShellVm}
          showRuntimeExecutionGovernanceBoundary={!pExecutionGovernanceBoundary.omitFromDom}
          executionGovernanceBoundaryDefaultOpen={pExecutionGovernanceBoundary.defaultOpen}
          runtimeExecutionGovernanceBoundaryVm={runtimePlanningExecutionGovernanceBoundaryVm}
          showRuntimeGovernanceReleaseReadiness={!pGovernanceReleaseReadiness.omitFromDom}
          governanceReleaseReadinessDefaultOpen={pGovernanceReleaseReadiness.defaultOpen}
          runtimeGovernanceReleaseReadinessVm={runtimePlanningGovernanceReleaseReadinessVm}
          showRuntimeFinalReleaseGovernanceGate={!pFinalReleaseGovernanceGate.omitFromDom}
          finalReleaseGovernanceGateDefaultOpen={pFinalReleaseGovernanceGate.defaultOpen}
          runtimeFinalReleaseGovernanceGateVm={runtimePlanningFinalReleaseGovernanceGateVm}
          showRuntimeUltimateGovernanceReview={!pUltimateGovernanceReview.omitFromDom}
          ultimateGovernanceReviewDefaultOpen={pUltimateGovernanceReview.defaultOpen}
          runtimeUltimateGovernanceReviewVm={runtimePlanningUltimateGovernanceReviewVm}
          showRuntimeControlledActivationCandidate={!pControlledActivationCandidate.omitFromDom}
          controlledActivationCandidateDefaultOpen={pControlledActivationCandidate.defaultOpen}
          runtimeControlledActivationCandidateVm={runtimePlanningControlledActivationCandidateVm}
          showRuntimeLimitedPilotBoundary={!pLimitedPilotBoundary.omitFromDom}
          limitedPilotBoundaryDefaultOpen={pLimitedPilotBoundary.defaultOpen}
          runtimeLimitedPilotBoundaryVm={runtimePlanningLimitedPilotBoundaryVm}
          showRuntimeLimitedPilotReadinessReview={!pLimitedPilotReadinessReview.omitFromDom}
          limitedPilotReadinessReviewDefaultOpen={pLimitedPilotReadinessReview.defaultOpen}
          runtimeLimitedPilotReadinessReviewVm={runtimePlanningLimitedPilotReadinessReviewVm}
          showRuntimePilotExecutionReadiness={!pPilotExecutionReadiness.omitFromDom}
          pilotExecutionReadinessDefaultOpen={pPilotExecutionReadiness.defaultOpen}
          runtimePilotExecutionReadinessVm={runtimePlanningPilotExecutionReadinessVm}
          showForecast={!pForecast.omitFromDom && resourceThroughNoopExecutionShellOmitted}
          showDecision={
            !pDecision.omitFromDom && pForecast.omitFromDom && resourceThroughNoopExecutionShellOmitted
          }
          showSemanticVocabulary={
            !pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
          showSemanticNarrative={
            !pSemanticNarrative.omitFromDom &&
            pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
          showSemanticGraph={
            !pSemanticGraph.omitFromDom &&
            pSemanticNarrative.omitFromDom &&
            pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
          showSemantic={
            !pSemantic.omitFromDom &&
            pSemanticGraph.omitFromDom &&
            pSemanticNarrative.omitFromDom &&
            pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
          showReasoning={
            !pReason.omitFromDom &&
            pSemantic.omitFromDom &&
            pSemanticGraph.omitFromDom &&
            pSemanticNarrative.omitFromDom &&
            pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
          showTraceability={
            !pTrace.omitFromDom &&
            pReason.omitFromDom &&
            pSemantic.omitFromDom &&
            pSemanticGraph.omitFromDom &&
            pSemanticNarrative.omitFromDom &&
            pSemanticVocabulary.omitFromDom &&
            pDecision.omitFromDom &&
            pForecast.omitFromDom &&
            resourceThroughNoopExecutionShellOmitted
          }
        />
      ) : null}
      {!pRt.omitFromDom || !pGov.omitFromDom || !pEnf.omitFromDom || !pCEg.omitFromDom ? (
        <details open={!compactAndNarrowUi} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <summary
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#64748b",
              padding: "0 2px",
              cursor: "pointer",
              listStyle: "none",
            }}
          >
            Runtime planning (H10–H11.5, read-only)
          </summary>
          {!pRt.omitFromDom ? <OverlayRuntimeTrialSection vm={runtimeTrialVm} defaultOpen={pRt.defaultOpen} /> : null}
          {!pGov.omitFromDom ? (
            <OverlayRuntimeGovernanceSection vm={runtimeGovernanceVm} defaultOpen={pGov.defaultOpen} />
          ) : null}
          {!pEnf.omitFromDom ? (
            <OverlayRuntimeEnforcementCandidateSection vm={runtimeEnforcementVm} defaultOpen={pEnf.defaultOpen} />
          ) : null}
          {!pCEg.omitFromDom ? (
            <OverlayControlledEnforcementGovernanceSection
              vm={controlledEnforcementGovVm}
              defaultOpen={pCEg.defaultOpen}
            />
          ) : null}
        </details>
      ) : null}
      {advancedClip.hiddenCount > 0 ? (
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", padding: "4px 2px" }}>
          고급 Harness 섹션 {advancedClip.hiddenCount}건은 화면 budget으로 숨겼습니다. 넓은 화면·일반 모드에서 확인하세요.
        </div>
      ) : null}
    </div>
  );
}
