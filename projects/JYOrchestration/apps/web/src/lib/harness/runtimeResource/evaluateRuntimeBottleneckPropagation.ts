/**
 * H20.5 — **Bottleneck propagation** 해석(read-only; graph·forecast·decision 결과만 참조, 재계산 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeBottleneckPropagation, RuntimeResourceSeverity } from "./runtimeResourceTypes";

export function evaluateRuntimeBottleneckPropagation(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeBottleneckPropagation {
  const criticalPaths = reports.semanticGraphRelevanceSummary.rankedPaths.filter(
    (p) => p.severity === "critical_candidate"
  ).length;
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const coherence = reports.runtimeDecisionCoherence.overallLevel;

  let propagationSeverity: RuntimeResourceSeverity = "low";
  if (criticalPaths > 1 || explosion === "high") propagationSeverity = "high";
  else if (criticalPaths > 0 || explosion === "medium" || coherence === "divergent") {
    propagationSeverity = "medium";
  }

  const bottleneckChainKo =
    criticalPaths > 0
      ? `graph relevance critical path=${criticalPaths} → resource bottleneck 후보`
      : "graph critical path 제한적 — bottleneck chain 관측 낮음";

  const slowdownRiskKo =
    propagationSeverity === "high"
      ? "orchestration slowdown risk 상승(메타)"
      : propagationSeverity === "medium"
        ? "slowdown risk 중간(메타)"
        : "slowdown risk 낮음(메타)";

  return {
    mode: "runtime_bottleneck_propagation",
    actualRuntimeOrchestrationEnabled: false,
    propagationSeverity,
    bottleneckChainKo,
    slowdownRiskKo,
  };
}
