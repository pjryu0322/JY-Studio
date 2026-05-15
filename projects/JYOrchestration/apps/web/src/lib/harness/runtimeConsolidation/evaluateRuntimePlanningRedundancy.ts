/**
 * H14.5 — planning **redundancy** 메타 분석(구조 정리 힌트; 실행 영향 없음).
 */

import type {
  NormalizedRuntimePlanningContext,
  RuntimePlanningRedundancySummary,
} from "./runtimePlanningConsolidationTypes";

type Risk = RuntimePlanningRedundancySummary["duplicateSummaryGenerationRisk"];

function maxRisk(a: Risk, b: Risk): Risk {
  const order: Risk[] = ["low", "medium", "high"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

export function evaluateRuntimePlanningRedundancy(
  ctx: NormalizedRuntimePlanningContext
): RuntimePlanningRedundancySummary {
  const findings: string[] = [];
  let duplicateSummaryGenerationRisk: Risk = "low";
  let duplicateSerializationRisk: Risk = "low";
  let duplicateOverlayMappingRisk: Risk = "low";
  let duplicateWarningGroupingRisk: Risk = "low";

  const { freshnessSummary, driftReport } = ctx.lifecycleReports;
  const { coherenceSummary, divergenceReport } = ctx.coherenceReports;

  if (driftReport.driftAreas.length > 0 && divergenceReport.divergenceAreas.length > 0) {
    const overlap = driftReport.driftAreas.filter((a) => divergenceReport.divergenceAreas.includes(a));
    if (overlap.length > 0) {
      findings.push("lifecycle drift와 coherence divergence 영역이 겹칩니다 — unified summary 우선 확인.");
      duplicateSummaryGenerationRisk = maxRisk(duplicateSummaryGenerationRisk, "medium");
    }
  }

  if (
    freshnessSummary.freshnessLevel === "stale" &&
    coherenceSummary.coherenceLevel !== "aligned"
  ) {
    findings.push("lifecycle freshness와 coherence 불일치 — 배너·섹션 중복 노출을 피하고 consolidated 그룹 사용.");
    duplicateWarningGroupingRisk = maxRisk(duplicateWarningGroupingRisk, "medium");
  }

  findings.push("진단 API는 normalizeRuntimePlanningContext 1회 경로로 H12–H14 reports를 공유합니다.");
  findings.push("Overlay는 compact+narrow에서 lifecycle/coherence 개별 섹션 DOM 생략 정책을 적용합니다.");

  duplicateSerializationRisk = "low";
  duplicateOverlayMappingRisk = "low";

  const recommendations: string[] = [
    "Redundancy 평가는 planning 구조 힌트만 제공합니다. payload·DB 변경 없음.",
    duplicateWarningGroupingRisk !== "low"
      ? "stale·coherence 경고는 unified summary와 lifecycle/coherence 그룹으로 집중하세요."
      : "현재 consolidation 경로가 중복 계산을 억제합니다.",
  ];

  return {
    mode: "runtime_planning_redundancy_summary",
    actualRuntimeOrchestrationEnabled: false,
    duplicateSummaryGenerationRisk,
    duplicateSerializationRisk,
    duplicateOverlayMappingRisk,
    duplicateWarningGroupingRisk,
    consolidationApplied: true,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningRedundancySummaryForDiagnostic(
  summary: RuntimePlanningRedundancySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    duplicateSummaryGenerationRisk: summary.duplicateSummaryGenerationRisk,
    duplicateSerializationRisk: summary.duplicateSerializationRisk,
    duplicateOverlayMappingRisk: summary.duplicateOverlayMappingRisk,
    duplicateWarningGroupingRisk: summary.duplicateWarningGroupingRisk,
    consolidationApplied: summary.consolidationApplied,
    findings: [...summary.findings],
    recommendations: [...summary.recommendations],
  };
}
