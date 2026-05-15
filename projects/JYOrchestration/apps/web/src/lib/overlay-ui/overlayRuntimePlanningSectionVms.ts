/**
 * H12–H15 — Overlay planning 섹션 VM 일괄 산출(normalize 1회).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildUnifiedRuntimePlanningSummary } from "@/lib/harness/runtimeConsolidation/buildUnifiedRuntimePlanningSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import {
  RUNTIME_DEPENDENCY_SECTION_DISCLAIMER_KO,
  RUNTIME_PLANNING_DEPENDENCY_CONFLICT_SEVERITY_LABEL_KO,
  RUNTIME_PLANNING_GRAPH_NODE_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeDependency/runtimeDependencyLabelsKo";
import {
  RUNTIME_COHERENCE_SECTION_DISCLAIMER_KO,
  RUNTIME_PLANNING_COHERENCE_LABEL_KO,
  RUNTIME_PLANNING_DIVERGENCE_SEVERITY_LABEL_KO,
  RUNTIME_PLANNING_SYNCHRONIZATION_LABEL_KO,
} from "@/lib/harness/runtimeCoherence/runtimeCoherenceLabelsKo";
import {
  RUNTIME_LIFECYCLE_SECTION_DISCLAIMER_KO,
  RUNTIME_PLANNING_DRIFT_SEVERITY_LABEL_KO,
  RUNTIME_PLANNING_FRESHNESS_LABEL_KO,
  RUNTIME_PLANNING_LIFECYCLE_STATE_LABEL_KO,
} from "@/lib/harness/runtimeLifecycle/runtimeLifecycleLabelsKo";
import {
  CANDIDATE_CONFLICT_SEVERITY_LABEL_KO,
  CANDIDATE_SATURATION_LEVEL_LABEL_KO,
  RUNTIME_CANDIDATE_CONFLICT_KIND_LABEL_KO,
  RUNTIME_STABILITY_LEVEL_LABEL_KO,
  RUNTIME_STABILITY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeStability/runtimeStabilityLabelsKo";
import {
  RUNTIME_ESCALATION_LEVEL_LABEL_KO,
  RUNTIME_PLANNING_PRIORITY_LABEL_KO,
  RUNTIME_PRIORITY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimePriority/runtimePriorityLabelsKo";
import type { OverlayRuntimeDependencyGraphSectionVM } from "./overlayRuntimeDependencyAdapter";
import type { OverlayRuntimeCoherenceSectionVM } from "./overlayRuntimeCoherenceAdapter";
import type { OverlayRuntimeLifecycleSectionVM } from "./overlayRuntimeLifecycleAdapter";
import type { OverlayRuntimePlanningConsolidatedSectionVM } from "./overlayRuntimePlanningConsolidatedAdapter";
import type { OverlayRuntimePrioritySectionVM } from "./overlayRuntimePriorityAdapter";
import type { OverlayRuntimeStabilitySectionVM } from "./overlayRuntimeStabilityAdapter";

const CONSOLIDATED_DISCLAIMER_KO =
  "통합 planning 요약입니다. H12–H14 세부 섹션은 동일 평가 1회 결과를 공유합니다. actual orchestration 없음.";

export type OverlayRuntimePlanningSectionVms = Readonly<{
  stabilityVm: OverlayRuntimeStabilitySectionVM;
  priorityVm: OverlayRuntimePrioritySectionVM;
  lifecycleVm: OverlayRuntimeLifecycleSectionVM;
  coherenceVm: OverlayRuntimeCoherenceSectionVM;
  consolidatedVm: OverlayRuntimePlanningConsolidatedSectionVM;
  dependencyGraphVm: OverlayRuntimeDependencyGraphSectionVM;
}>;

export function buildOverlayRuntimePlanningSectionVms(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimePlanningSectionVms {
  const ctx = normalizeRuntimePlanningContext(input);
  const { governanceCtx, stabilityReports, priorityReports, lifecycleReports, coherenceReports } = ctx;
  const { freshnessSummary, driftReport, invalidationSummary } = lifecycleReports;
  const { coherenceSummary, synchronizationSummary, divergenceReport } = coherenceReports;
  const unified = buildUnifiedRuntimePlanningSummary(ctx);

  const showStaleLifecycleBanner =
    freshnessSummary.freshnessLevel === "stale" ||
    invalidationSummary.lifecycleState === "invalidated" ||
    driftReport.driftSeverity === "high";

  const lifecycleVm: OverlayRuntimeLifecycleSectionVM = {
    sectionDisclaimer: RUNTIME_LIFECYCLE_SECTION_DISCLAIMER_KO,
    freshnessLabel: RUNTIME_PLANNING_FRESHNESS_LABEL_KO[freshnessSummary.freshnessLevel],
    lifecycleStateLabel: RUNTIME_PLANNING_LIFECYCLE_STATE_LABEL_KO[invalidationSummary.lifecycleState],
    driftSeverityLabel: RUNTIME_PLANNING_DRIFT_SEVERITY_LABEL_KO[driftReport.driftSeverity],
    showStaleLifecycleBanner,
    staleLifecycleBannerMessage:
      invalidationSummary.lifecycleState === "invalidated"
        ? "Planning lifecycle 무효화 후보가 있습니다. 후보 메타를 planning_only로 유지하세요."
        : freshnessSummary.freshnessLevel === "stale"
          ? "Planning freshness가 오래되었습니다. H10–H11.5 세부 섹션을 재검토하세요."
          : "Planning drift가 높습니다. dependency·escalation 메타를 확인하세요.",
    agingFactors: freshnessSummary.agingFactors,
    staleFactors: freshnessSummary.staleFactors,
    driftAreas: driftReport.driftAreas,
    driftReasons: driftReport.driftReasons,
    invalidationCandidates: invalidationSummary.invalidationCandidates,
    staleDependencies: invalidationSummary.staleDependencies,
    stalePlanningAreas: invalidationSummary.stalePlanningAreas,
  };

  const coherenceOperatorAttention =
    coherenceSummary.coherenceLevel === "misaligned" ||
    synchronizationSummary.synchronizationState === "desynchronized" ||
    divergenceReport.divergenceSeverity === "high";

  const coherenceVm: OverlayRuntimeCoherenceSectionVM = {
    sectionDisclaimer: RUNTIME_COHERENCE_SECTION_DISCLAIMER_KO,
    coherenceLabel: RUNTIME_PLANNING_COHERENCE_LABEL_KO[coherenceSummary.coherenceLevel],
    synchronizationLabel: RUNTIME_PLANNING_SYNCHRONIZATION_LABEL_KO[synchronizationSummary.synchronizationState],
    divergenceSeverityLabel: RUNTIME_PLANNING_DIVERGENCE_SEVERITY_LABEL_KO[divergenceReport.divergenceSeverity],
    alignmentScoreLabel: `${coherenceSummary.alignmentScore}`,
    operatorAttentionRequired: coherenceOperatorAttention,
    misalignedAreas: coherenceSummary.misalignedAreas,
    laggingLayers: synchronizationSummary.laggingLayers,
    staleConsistencyIssues: synchronizationSummary.staleConsistencyIssues,
    divergenceAreas: divergenceReport.divergenceAreas,
    divergenceReasons: divergenceReport.divergenceReasons,
  };

  const consolidatedVm: OverlayRuntimePlanningConsolidatedSectionVM = {
    sectionDisclaimer: CONSOLIDATED_DISCLAIMER_KO,
    stabilityHeadline: unified.stability.headline,
    stabilityDetail: unified.stability.detail ?? "—",
    priorityHeadline: unified.priority.headline,
    priorityDetail: unified.priority.detail ?? "—",
    lifecycleHeadline: unified.lifecycle.headline,
    lifecycleDetail: unified.lifecycle.detail ?? "—",
    coherenceHeadline: unified.coherence.headline,
    coherenceDetail: unified.coherence.detail ?? "—",
    criticalIssues: unified.criticalIssues,
    showAttention: unified.criticalIssues.length > 0,
  };

  const dependencyReports = buildRuntimeDependencyPlanningReports(ctx);
  const { dependencyGraph, impactPropagationSummary, dependencyConflictSummary } = dependencyReports;
  const dependencyGraphVm: OverlayRuntimeDependencyGraphSectionVM = {
    sectionDisclaimer: RUNTIME_DEPENDENCY_SECTION_DISCLAIMER_KO,
    conflictSeverityLabel:
      RUNTIME_PLANNING_DEPENDENCY_CONFLICT_SEVERITY_LABEL_KO[dependencyConflictSummary.severity],
    showAttention:
      dependencyConflictSummary.severity === "high" ||
      dependencyGraph.criticalDependencies.length >= 2 ||
      dependencyConflictSummary.circularDependencies.length > 0,
    nodeRows: dependencyGraph.nodes.map((n) => ({
      id: n.id,
      label: n.labelKo,
      statusLabel: RUNTIME_PLANNING_GRAPH_NODE_STATUS_LABEL_KO[n.status],
    })),
    edgeRows: dependencyGraph.edges.map((e) => `${e.from} → ${e.to} (${e.relationKo})`),
    criticalDependencies: dependencyGraph.criticalDependencies,
    isolatedNodes: dependencyGraph.isolatedNodes,
    dependencyChains: dependencyGraph.dependencyChains,
    driftPropagationPaths: impactPropagationSummary.driftPropagationPaths,
    stalePropagationPaths: impactPropagationSummary.stalePropagationPaths,
  };

  const governanceUnstable =
    governanceCtx.governance.governanceRisk === "high" || governanceCtx.governance.governanceRisk === "medium";
  const explainabilityUnstable =
    !input.messageExplainabilityAvailable || !input.maturityBaseline.userVisibleSummaryReady;

  const showSaturationBanner =
    stabilityReports.saturationSummary.saturationLevel === "high" ||
    stabilityReports.stabilitySummary.stabilityLevel === "unstable" ||
    stabilityReports.overlayOverload.overlayOverloadRisk === "high";

  const saturationBannerMessage =
    stabilityReports.saturationSummary.saturationLevel === "high"
      ? "후보·거버넌스 planning 포화가 높습니다. Runtime planning 섹션은 접힌 상태를 권장합니다."
      : stabilityReports.stabilitySummary.stabilityLevel === "unstable"
        ? "Planning stability가 불안정합니다. 후보 충돌·dependency를 먼저 확인하세요."
        : "Overlay 과밀 위험이 있습니다. compact·narrow 모드에서 일부 섹션이 숨겨질 수 있습니다.";

  const escalation = priorityReports.escalationSummary;

  return {
    stabilityVm: {
      sectionDisclaimer: RUNTIME_STABILITY_SECTION_DISCLAIMER_KO,
      stabilityLevelLabel: RUNTIME_STABILITY_LEVEL_LABEL_KO[stabilityReports.stabilitySummary.stabilityLevel],
      conflictSeverityLabel: CANDIDATE_CONFLICT_SEVERITY_LABEL_KO[stabilityReports.conflictReport.severity],
      saturationLevelLabel: CANDIDATE_SATURATION_LEVEL_LABEL_KO[stabilityReports.saturationSummary.saturationLevel],
      showSaturationBanner,
      saturationBannerMessage,
      conflictRows: stabilityReports.conflictReport.conflicts.map((c) => ({
        title: RUNTIME_CANDIDATE_CONFLICT_KIND_LABEL_KO[c.kind] ?? c.labelKo,
        severityLabel: CANDIDATE_CONFLICT_SEVERITY_LABEL_KO[c.severity],
        note: c.noteKo,
      })),
      blockedCandidates: stabilityReports.conflictReport.blockedCandidates,
      recommendedCandidates: stabilityReports.conflictReport.recommendedCandidates,
      criticalDependencies: stabilityReports.stabilitySummary.criticalDependencies,
      riskFactors: stabilityReports.stabilitySummary.riskFactors,
      unstableGovernanceNote: governanceUnstable
        ? `거버넌스 리스크 ${governanceCtx.governance.governanceRisk} — 후보 orchestration stability 저하 가능.`
        : "거버넌스 planning 신호는 관측 범위에서 안정적입니다.",
      unstableExplainabilityNote: explainabilityUnstable
        ? "Explainability·사용자 요약 경로 불안정 — enforcement planning 신뢰 저하."
        : "Explainability 경로는 planning 판단에 사용 가능합니다.",
    },
    priorityVm: {
      sectionDisclaimer: RUNTIME_PRIORITY_SECTION_DISCLAIMER_KO,
      overallPlanningPriorityLabel:
        RUNTIME_PLANNING_PRIORITY_LABEL_KO[priorityReports.bottleneckSummary.overallPlanningPriority],
      escalationLevelLabel: RUNTIME_ESCALATION_LEVEL_LABEL_KO[escalation.escalationLevel],
      showEscalationBadge:
        escalation.escalationLevel === "escalated" || escalation.escalationLevel === "critical",
      operatorAttentionRequired: escalation.operatorAttentionRequired,
      operatorAttentionLabel: escalation.operatorAttentionRequired
        ? "운영자 attention 필요(메타)"
        : "운영자 attention 불필요(메타)",
      dependencyRows: priorityReports.dependencyReport.orderedDependencies.map((d) => ({
        title: d.labelKo,
        priorityLabel: RUNTIME_PLANNING_PRIORITY_LABEL_KO[d.priority],
        status: d.status,
        note: d.noteKo,
      })),
      bottleneckRows: priorityReports.bottleneckSummary.bottlenecks.map((b) => ({
        title: b.labelKo,
        priorityLabel: RUNTIME_PLANNING_PRIORITY_LABEL_KO[b.priority],
        note: b.noteKo,
      })),
      criticalDependencies: priorityReports.dependencyReport.criticalDependencies,
      dependencyCycles: priorityReports.dependencyReport.dependencyCycles,
      escalationReasons: escalation.escalationReasons,
    },
    lifecycleVm,
    coherenceVm,
    consolidatedVm,
    dependencyGraphVm,
  };
}
