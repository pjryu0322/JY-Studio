/**
 * H19.5 — read-only **orchestration recommendation** metadata(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeDecision } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { RUNTIME_RECOMMENDATION_LABEL_KO } from "./runtimeDecisionLabelsKo";
import type {
  RuntimeRecommendationEntry,
  RuntimeRecommendationKind,
  RuntimeRecommendationSummary,
} from "./runtimeDecisionTypes";

const MAX_RECOMMENDATIONS = 5;

export function buildRuntimeRecommendationSummary(
  semanticReports: RuntimeSemanticPlanningReportsBeforeDecision
): RuntimeRecommendationSummary {
  const entries: RuntimeRecommendationEntry[] = [];

  const add = (kind: RuntimeRecommendationKind, priority: number, severity: RuntimeRecommendationEntry["severity"]) => {
    if (entries.some((e) => e.kind === kind)) return;
    entries.push({
      kind,
      labelKo: RUNTIME_RECOMMENDATION_LABEL_KO[kind],
      priority,
      severity,
    });
  };

  if (semanticReports.hiddenTraceAudit.hiddenGovernanceWarningCount > 0) {
    add("governance_review", 90, "critical_candidate");
  }
  if (semanticReports.semanticExplosionRiskSummary.explosionRisk !== "low") {
    add("reduce_semantic_explosion", 80, "watch");
  }
  if (semanticReports.compressionQualityReport.quality === "over_compressed") {
    add("stabilize_memory_scope", 70, "watch");
  }
  if (semanticReports.semanticGraphRelevanceSummary.rankedPaths.some((r) => r.severity === "critical_candidate")) {
    add("routing_ambiguity", 65, "watch");
  }
  if (entries.length === 0) {
    add("maintain_stable_planning", 10, "info");
  }

  const sorted = entries.sort((a, b) => b.priority - a.priority).slice(0, MAX_RECOMMENDATIONS);

  const routingImplicationKo =
    sorted[0]?.kind === "routing_ambiguity"
      ? "routing ambiguity — execution routing metadata 재검토 권장(실행 없음)."
      : sorted[0]?.kind === "governance_review"
        ? "governance 신호 — enforcement 후보 전 planning review 권장."
        : "routing implication 낮음 — 현재 read-only observability 경로 유지.";

  return {
    mode: "runtime_recommendation_summary",
    actualRuntimeOrchestrationEnabled: false,
    recommendations: sorted,
    primaryRecommendationKo: sorted[0]?.labelKo ?? RUNTIME_RECOMMENDATION_LABEL_KO.maintain_stable_planning,
    routingImplicationKo,
  };
}

export function serializeRuntimeRecommendationSummaryForDiagnostic(
  summary: RuntimeRecommendationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    recommendations: summary.recommendations.map((r) => ({ ...r })),
    primaryRecommendationKo: summary.primaryRecommendationKo,
    routingImplicationKo: summary.routingImplicationKo,
  };
}
