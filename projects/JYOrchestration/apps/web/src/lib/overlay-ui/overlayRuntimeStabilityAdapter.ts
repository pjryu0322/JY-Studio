/**
 * H12 — Overlay **runtime stability** 섹션 ViewModel(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildRuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import {
  CANDIDATE_CONFLICT_SEVERITY_LABEL_KO,
  CANDIDATE_SATURATION_LEVEL_LABEL_KO,
  RUNTIME_CANDIDATE_CONFLICT_KIND_LABEL_KO,
  RUNTIME_STABILITY_LEVEL_LABEL_KO,
  RUNTIME_STABILITY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeStability/runtimeStabilityLabelsKo";

export type OverlayRuntimeStabilitySectionVM = Readonly<{
  sectionDisclaimer: string;
  stabilityLevelLabel: string;
  conflictSeverityLabel: string;
  saturationLevelLabel: string;
  showSaturationBanner: boolean;
  saturationBannerMessage: string;
  conflictRows: readonly Readonly<{ title: string; severityLabel: string; note: string }>[];
  blockedCandidates: readonly string[];
  recommendedCandidates: readonly string[];
  criticalDependencies: readonly string[];
  riskFactors: readonly string[];
  unstableGovernanceNote: string;
  unstableExplainabilityNote: string;
}>;

export function buildOverlayRuntimeStabilitySectionVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly overlayWarningCount: number;
  readonly compactAndNarrowUi?: boolean;
}): OverlayRuntimeStabilitySectionVM {
  const governanceCtx = buildRuntimeGovernancePlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    extract: input.overlay,
  });
  const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
  });
  const reports = buildRuntimeStabilityPlanningReports({
    baseline: input.maturityBaseline,
    releaseGate: input.releaseGate,
    governanceCtx,
    enforcementPlanning,
    extract: input.overlay,
    messageExplainabilityAvailable: input.messageExplainabilityAvailable,
    overlayWarningCount: input.overlayWarningCount,
    compactAndNarrowUi: input.compactAndNarrowUi,
  });

  const governanceUnstable =
    governanceCtx.governance.governanceRisk === "high" || governanceCtx.governance.governanceRisk === "medium";
  const explainabilityUnstable =
    !input.messageExplainabilityAvailable || !input.maturityBaseline.userVisibleSummaryReady;

  const showSaturationBanner =
    reports.saturationSummary.saturationLevel === "high" ||
    reports.stabilitySummary.stabilityLevel === "unstable" ||
    reports.overlayOverload.overlayOverloadRisk === "high";

  const saturationBannerMessage =
    reports.saturationSummary.saturationLevel === "high"
      ? "후보·거버넌스 planning 포화가 높습니다. Runtime planning 섹션은 접힌 상태를 권장합니다."
      : reports.stabilitySummary.stabilityLevel === "unstable"
        ? "Planning stability가 불안정합니다. 후보 충돌·dependency를 먼저 확인하세요."
        : "Overlay 과밀 위험이 있습니다. compact·narrow 모드에서 일부 섹션이 숨겨질 수 있습니다.";

  return {
    sectionDisclaimer: RUNTIME_STABILITY_SECTION_DISCLAIMER_KO,
    stabilityLevelLabel: RUNTIME_STABILITY_LEVEL_LABEL_KO[reports.stabilitySummary.stabilityLevel],
    conflictSeverityLabel: CANDIDATE_CONFLICT_SEVERITY_LABEL_KO[reports.conflictReport.severity],
    saturationLevelLabel: CANDIDATE_SATURATION_LEVEL_LABEL_KO[reports.saturationSummary.saturationLevel],
    showSaturationBanner,
    saturationBannerMessage,
    conflictRows: reports.conflictReport.conflicts.map((c) => ({
      title: RUNTIME_CANDIDATE_CONFLICT_KIND_LABEL_KO[c.kind] ?? c.labelKo,
      severityLabel: CANDIDATE_CONFLICT_SEVERITY_LABEL_KO[c.severity],
      note: c.noteKo,
    })),
    blockedCandidates: reports.conflictReport.blockedCandidates,
    recommendedCandidates: reports.conflictReport.recommendedCandidates,
    criticalDependencies: reports.stabilitySummary.criticalDependencies,
    riskFactors: reports.stabilitySummary.riskFactors,
    unstableGovernanceNote: governanceUnstable
      ? `거버넌스 리스크 ${governanceCtx.governance.governanceRisk} — 후보 orchestration stability 저하 가능.`
      : "거버넌스 planning 신호는 관측 범위에서 안정적입니다.",
    unstableExplainabilityNote: explainabilityUnstable
      ? "Explainability·사용자 요약 경로 불안정 — enforcement planning 신뢰 저하."
      : "Explainability 경로는 planning 판단에 사용 가능합니다.",
  };
}
