/**
 * H16.5 — reasoning **redundancy** 평가(read-only).
 */

import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import type { RuntimeReasoningRedundancyRisk, RuntimeReasoningRedundancySummary } from "./runtimeReasoningTypes";

function maxRisk(a: RuntimeReasoningRedundancyRisk, b: RuntimeReasoningRedundancyRisk): RuntimeReasoningRedundancyRisk {
  const order: RuntimeReasoningRedundancyRisk[] = ["low", "medium", "high"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

export function evaluateRuntimeReasoningRedundancy(
  dependencyReports: RuntimeDependencyPlanningReports,
  criticalityReports: RuntimeCriticalityPlanningReports,
  traceabilityReports: RuntimeTraceabilityPlanningReports
): RuntimeReasoningRedundancySummary {
  const findings: string[] = [];
  let duplicateReasoningGenerationRisk: RuntimeReasoningRedundancyRisk = "low";
  let duplicatePropagationTraceRisk: RuntimeReasoningRedundancyRisk = "low";
  let duplicateOverlayMappingRisk: RuntimeReasoningRedundancyRisk = "low";
  let duplicateLifecycleReasoningRisk: RuntimeReasoningRedundancyRisk = "low";

  const impactPaths = dependencyReports.impactPropagationSummary.driftPropagationPaths;
  const depTracePaths = traceabilityReports.dependencyReasoningTraceSummary.propagationReasoning;
  const overlap = impactPaths.filter((p) =>
    depTracePaths.some((d) => d.includes(p.split(" ")[0] ?? p))
  );
  if (overlap.length > 0 || (impactPaths.length > 0 && depTracePaths.length > 0)) {
    findings.push("H15 impact propagation과 H16 dependency reasoning trace가 겹칠 수 있음 — unified reasoning 우선.");
    duplicatePropagationTraceRisk = maxRisk(duplicatePropagationTraceRisk, "medium");
  }

  const priPaths = criticalityReports.priorityPropagationSummary.dependencyPriorityPaths;
  const critNodes = criticalityReports.criticalitySummary.criticalNodes;
  if (priPaths.length >= 4 && critNodes.length >= 2) {
    findings.push("criticality propagation과 critical node 목록이 reasoning chain과 중복될 수 있음.");
    duplicateReasoningGenerationRisk = maxRisk(duplicateReasoningGenerationRisk, "medium");
  }

  if (traceabilityReports.reasoningChain.reasoningSteps.length > 10) {
    findings.push("reasoning step 수가 많음 — H16.5 unified chain·normalization으로 overlay 과밀 완화.");
    duplicateOverlayMappingRisk = maxRisk(duplicateOverlayMappingRisk, "medium");
  }

  findings.push("진단 API는 dependency/criticality/traceability reports 1회 빌드 후 H16.5 consolidation을 공유합니다.");
  findings.push("Overlay는 reasoning 섹션 통합 시 traceability DOM 생략 정책을 적용합니다.");

  const recommendations: string[] = [
    "Reasoning redundancy는 planning 구조 힌트만 제공합니다. enforcement·routing 없음.",
    duplicatePropagationTraceRisk !== "low"
      ? "propagation trace는 normalized reasoning trace와 unified chain으로 집중하세요."
      : "현재 consolidation 경로가 중복 reasoning 생성을 억제합니다.",
  ];

  return {
    mode: "runtime_reasoning_redundancy_summary",
    actualRuntimeOrchestrationEnabled: false,
    duplicateReasoningGenerationRisk,
    duplicatePropagationTraceRisk,
    duplicateOverlayMappingRisk,
    duplicateLifecycleReasoningRisk,
    consolidationApplied: true,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeReasoningRedundancySummaryForDiagnostic(
  summary: RuntimeReasoningRedundancySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    duplicateReasoningGenerationRisk: summary.duplicateReasoningGenerationRisk,
    duplicatePropagationTraceRisk: summary.duplicatePropagationTraceRisk,
    duplicateOverlayMappingRisk: summary.duplicateOverlayMappingRisk,
    duplicateLifecycleReasoningRisk: summary.duplicateLifecycleReasoningRisk,
    consolidationApplied: summary.consolidationApplied,
    findings: [...summary.findings],
    recommendations: [...summary.recommendations],
  };
}
