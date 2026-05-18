/**
 * H20 — governance **drift** 예측(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeForecast } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeForecastGovernanceDrift, RuntimeForecastGovernanceDriftKind } from "./runtimeForecastTypes";

const MAX_DRIFTS = 4;

function drift(
  kind: RuntimeForecastGovernanceDriftKind,
  severity: RuntimeForecastGovernanceDrift["drifts"][number]["severity"],
  labelKo: string
): RuntimeForecastGovernanceDrift["drifts"][number] {
  return { kind, severity, labelKo };
}

export function predictRuntimeGovernanceDrift(
  reports: RuntimeSemanticPlanningReportsBeforeForecast
): RuntimeForecastGovernanceDrift {
  const drifts: RuntimeForecastGovernanceDrift["drifts"][number][] = [];
  const vocabGroups = reports.semanticVocabularySummary.groups.length;
  const normalizedCount = reports.semanticNormalizedLabels.length;
  const recKinds = new Set(reports.runtimeRecommendationSummary.recommendations.map((r) => r.kind));

  if (reports.hiddenTraceAudit.hiddenGovernanceWarningCount > 0) {
    drifts.push(
      drift(
        "wording_divergence",
        reports.hiddenTraceAudit.hiddenGovernanceWarningCount > 1 ? "high" : "medium",
        "governance wording·hidden trace divergence 가능"
      )
    );
  }
  if (reports.compressionQualityReport.quality !== "safe" || reports.semanticExplosionRiskSummary.explosionRisk !== "low") {
    drifts.push(
      drift(
        "semantic_mismatch",
        reports.semanticExplosionRiskSummary.explosionRisk === "high" ? "high" : "medium",
        "semantic compression·explosion 신호와 vocabulary 정렬 불일치 가능"
      )
    );
  }
  if (recKinds.size > 2 || reports.runtimeDecisionCoherence.overallLevel !== "aligned") {
    drifts.push(
      drift(
        "recommendation_inconsistency",
        reports.runtimeDecisionCoherence.overallLevel === "divergent" ? "high" : "medium",
        "recommendation·coherence 간 불일치 가능"
      )
    );
  }
  if (vocabGroups > 3 && normalizedCount > 8) {
    drifts.push(
      drift("overlay_inconsistency", "medium", "vocabulary·normalized label 과밀로 overlay inconsistency 가능")
    );
  }
  if (drifts.length === 0) {
    drifts.push(drift("wording_divergence", "low", "governance drift 신호 미약 — planning 범위 stable"));
  }

  const severityRank = { low: 0, medium: 1, high: 2, critical_candidate: 3 };
  const sorted = [...drifts].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]).slice(0, MAX_DRIFTS);

  return {
    mode: "runtime_forecast_governance_drift",
    actualRuntimeOrchestrationEnabled: false,
    drifts: sorted,
    primaryDriftKo: sorted[0]?.labelKo ?? "governance drift 관측 없음",
  };
}

export function serializeRuntimeForecastGovernanceDriftForDiagnostic(
  driftReport: RuntimeForecastGovernanceDrift
): Readonly<Record<string, unknown>> {
  return {
    mode: driftReport.mode,
    actualRuntimeOrchestrationEnabled: driftReport.actualRuntimeOrchestrationEnabled,
    drifts: driftReport.drifts.map((d) => ({ ...d })),
    primaryDriftKo: driftReport.primaryDriftKo,
  };
}
