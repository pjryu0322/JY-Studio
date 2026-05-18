/**
 * H17 — semantic **redundancy** 평가(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticGroupsSummary } from "./runtimeSemanticTypes";
import type { RuntimeSemanticRedundancyRisk, RuntimeSemanticRedundancySummary } from "./runtimeSemanticTypes";

function maxRisk(a: RuntimeSemanticRedundancyRisk, b: RuntimeSemanticRedundancyRisk): RuntimeSemanticRedundancyRisk {
  const order: RuntimeSemanticRedundancyRisk[] = ["low", "medium", "high"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

export function evaluateRuntimeSemanticRedundancy(
  reasoningReports: RuntimeReasoningPlanningReports,
  groupsSummary: RuntimeSemanticGroupsSummary
): RuntimeSemanticRedundancySummary {
  const findings: string[] = [];
  let duplicateSemanticGroupingRisk: RuntimeSemanticRedundancyRisk = "low";
  let duplicatePropagationCompressionRisk: RuntimeSemanticRedundancyRisk = "low";
  let duplicateOverlaySemanticMappingRisk: RuntimeSemanticRedundancyRisk = "low";
  let reasoningExplosionRisk: RuntimeSemanticRedundancyRisk = "low";

  const { reasoningRedundancySummary, unifiedReasoningChain } = reasoningReports;

  if (reasoningRedundancySummary.duplicatePropagationTraceRisk !== "low") {
    findings.push("H16.5 propagation redundancy — H17 semantic compression으로 overlay trace를 단일화하세요.");
    duplicatePropagationCompressionRisk = maxRisk(duplicatePropagationCompressionRisk, "medium");
  }

  if (groupsSummary.groups.length >= 5 && unifiedReasoningChain.stableOrdering.length >= 8) {
    findings.push("semantic group·stable ordering 동시 증가 — reasoning explosion 위험.");
    reasoningExplosionRisk = maxRisk(reasoningExplosionRisk, "medium");
  }

  if (reasoningRedundancySummary.duplicateOverlayMappingRisk !== "low") {
    findings.push("overlay semantic·reasoning 섹션 중복 매핑 — semantic 표시 시 reasoning DOM 생략 정책 적용.");
    duplicateOverlaySemanticMappingRisk = maxRisk(duplicateOverlaySemanticMappingRisk, "medium");
  }

  const dupKinds = groupsSummary.groups.filter((g) => g.compressedItems.length >= 3);
  if (dupKinds.length >= 2) {
    findings.push("다수 semantic group에 compressed item 밀집 — grouping duplication 점검.");
    duplicateSemanticGroupingRisk = maxRisk(duplicateSemanticGroupingRisk, "medium");
  }

  findings.push("진단 API는 reasoning reports 1회 빌드 후 H17 semantic layer를 공유합니다.");

  const recommendations: string[] = [
    "Semantic redundancy는 observability 안정화 힌트만 제공합니다. enforcement·routing 없음.",
    reasoningExplosionRisk !== "low"
      ? "compressed trace·stabilized ordering으로 mobile overflow를 완화하세요."
      : "현재 semantic compression 경로가 trace readability를 유지합니다.",
  ];

  return {
    mode: "runtime_semantic_redundancy_summary",
    actualRuntimeOrchestrationEnabled: false,
    duplicateSemanticGroupingRisk,
    duplicatePropagationCompressionRisk,
    duplicateOverlaySemanticMappingRisk,
    reasoningExplosionRisk,
    compressionApplied: true,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticRedundancySummaryForDiagnostic(
  summary: RuntimeSemanticRedundancySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    duplicateSemanticGroupingRisk: summary.duplicateSemanticGroupingRisk,
    duplicatePropagationCompressionRisk: summary.duplicatePropagationCompressionRisk,
    duplicateOverlaySemanticMappingRisk: summary.duplicateOverlaySemanticMappingRisk,
    reasoningExplosionRisk: summary.reasoningExplosionRisk,
    compressionApplied: summary.compressionApplied,
    findings: [...summary.findings],
    recommendations: [...summary.recommendations],
  };
}
