/**
 * H20 — semantic·governance·warning·routing·lifecycle **trend** 분석(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeForecast } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { RUNTIME_FORECAST_TREND_LABEL_KO } from "./runtimeForecastLabelsKo";
import type { RuntimeForecastTrend, RuntimeForecastTrendKind } from "./runtimeForecastTypes";

const MAX_TRENDS = 5;

function trend(
  kind: RuntimeForecastTrendKind,
  direction: RuntimeForecastTrend["direction"],
  severity: RuntimeForecastTrend["severity"],
  noteKo: string
): RuntimeForecastTrend {
  return {
    kind,
    direction,
    severity,
    labelKo: RUNTIME_FORECAST_TREND_LABEL_KO[kind],
    noteKo,
  };
}

export function analyzeRuntimeForecastTrends(
  reports: RuntimeSemanticPlanningReportsBeforeForecast
): readonly RuntimeForecastTrend[] {
  const trends: RuntimeForecastTrend[] = [];
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const quality = reports.compressionQualityReport.quality;
  const govHidden = reports.hiddenTraceAudit.hiddenGovernanceWarningCount;
  const warningCount = reports.semanticWarningOriginSummary.origins.length;
  const criticalPaths = reports.semanticGraphRelevanceSummary.rankedPaths.filter(
    (p) => p.severity === "critical_candidate"
  ).length;
  const coherence = reports.runtimeDecisionCoherence.overallLevel;

  if (explosion !== "low" || quality !== "safe") {
    trends.push(
      trend(
        "semantic_growth",
        explosion === "high" ? "accelerating" : "rising",
        explosion === "high" ? "high" : "medium",
        `compression quality=${quality}, explosion=${explosion}`
      )
    );
  } else {
    trends.push(trend("semantic_growth", "stable", "low", "semantic growth 신호 안정"));
  }

  if (govHidden > 0 || coherence === "divergent") {
    trends.push(
      trend(
        "governance_drift",
        govHidden > 1 ? "accelerating" : "rising",
        govHidden > 1 || coherence === "divergent" ? "high" : "medium",
        `hidden governance warnings=${govHidden}, coherence=${coherence}`
      )
    );
  } else {
    trends.push(trend("governance_drift", "stable", "low", "governance drift 신호 미약"));
  }

  if (warningCount > 2) {
    trends.push(
      trend(
        "warning_amplification",
        warningCount > 4 ? "accelerating" : "rising",
        warningCount > 4 ? "high" : "medium",
        `warning origins=${warningCount}`
      )
    );
  } else {
    trends.push(trend("warning_amplification", "stable", "low", "warning amplification 제한적"));
  }

  if (criticalPaths > 0 || reports.runtimeRecommendationSummary.recommendations.some((r) => r.kind === "routing_ambiguity")) {
    trends.push(
      trend(
        "routing_instability",
        criticalPaths > 1 ? "accelerating" : "rising",
        criticalPaths > 0 ? "high" : "medium",
        `critical graph paths=${criticalPaths}`
      )
    );
  } else {
    trends.push(trend("routing_instability", "stable", "low", "routing instability 신호 낮음"));
  }

  if (reports.runtimeDecisionCoherence.dimensions.some((d) => d.dimension === "lifecycle" && d.level !== "aligned")) {
    trends.push(
      trend("lifecycle_fragmentation", "rising", "medium", "lifecycle coherence partial/divergent")
    );
  } else {
    trends.push(trend("lifecycle_fragmentation", "stable", "low", "lifecycle fragmentation 관측 없음"));
  }

  const severityRank: Record<RuntimeForecastTrend["severity"], number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical_candidate: 3,
  };
  return trends
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, MAX_TRENDS);
}

export function serializeRuntimeForecastTrendsForDiagnostic(
  trends: readonly RuntimeForecastTrend[]
): Readonly<Record<string, unknown>> {
  return { trends: trends.map((t) => ({ ...t })) };
}
