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
  const showDependencyCriticalityGrouped =
    !pDep.omitFromDom || !pCrit.omitFromDom || !pTrace.omitFromDom;
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
      {showDependencyCriticalityGrouped &&
      (!pDep.omitFromDom || !pCrit.omitFromDom || !pTrace.omitFromDom) ? (
        <OverlayRuntimeDependencyCriticalityGroup
          dependencyVm={runtimePlanningDependencyVm}
          criticalityVm={runtimePlanningCriticalityVm}
          traceabilityVm={runtimePlanningTraceabilityVm}
          dependencyDefaultOpen={pDep.defaultOpen}
          criticalityDefaultOpen={pCrit.defaultOpen}
          traceabilityDefaultOpen={pTrace.defaultOpen}
          groupOpen={
            !compactAndNarrowUi && (pDep.defaultOpen || pCrit.defaultOpen || pTrace.defaultOpen)
          }
          showDependency={!pDep.omitFromDom}
          showCriticality={!pCrit.omitFromDom}
          showTraceability={!pTrace.omitFromDom}
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
