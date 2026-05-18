/**
 * H20 — forecast **summary**·snapshot(read-only).
 */

import type {
  RuntimeForecastEscalation,
  RuntimeForecastGovernanceDrift,
  RuntimeForecastRisk,
  RuntimeForecastSnapshot,
  RuntimeForecastStability,
  RuntimeForecastSummary,
  RuntimeForecastTrend,
} from "./runtimeForecastTypes";

const MAX_RISKS = 4;

function buildTopRisks(trends: readonly RuntimeForecastTrend[]): readonly RuntimeForecastRisk[] {
  const risks: RuntimeForecastRisk[] = trends
    .filter((t) => t.severity !== "low")
    .map((t) => ({
      code: `risk_${t.kind}`,
      severity: t.severity,
      labelKo: t.labelKo,
      saturationImplicationKo:
        t.kind === "semantic_growth" || t.kind === "warning_amplification"
          ? "orchestration saturation 가능성 상승"
          : "saturation risk 제한적",
    }));
  if (risks.length === 0) {
    risks.push({
      code: "risk_stable",
      severity: "low",
      labelKo: "Planning stable",
      saturationImplicationKo: "orchestration saturation risk 낮음",
    });
  }
  return risks.slice(0, MAX_RISKS);
}

function buildSnapshot(
  topRisks: readonly RuntimeForecastRisk[],
  stability: RuntimeForecastStability,
  escalation: RuntimeForecastEscalation
): RuntimeForecastSnapshot {
  const top = topRisks[0];
  return {
    snapshotId: `forecast-${stability.outlook}-${top?.code ?? "stable"}`,
    capturedAtLabel: "planning-observation",
    topRiskLabelKo: top?.labelKo ?? "—",
    saturationRiskKo: top?.saturationImplicationKo ?? "—",
    stabilityOutlook: stability.outlook,
    summaryKo: `${escalation.primaryChainKo} · ${stability.coherenceDriftRiskKo}`,
  };
}

export function buildRuntimeForecastSummary(
  trends: readonly RuntimeForecastTrend[],
  escalation: RuntimeForecastEscalation,
  governanceDrift: RuntimeForecastGovernanceDrift,
  stability: RuntimeForecastStability
): RuntimeForecastSummary {
  const topRisks = buildTopRisks(trends);
  const snapshot = buildSnapshot(topRisks, stability, escalation);
  const highTrend = trends.find((t) => t.severity === "high" || t.severity === "critical_candidate");

  return {
    mode: "runtime_forecast_summary",
    actualRuntimeOrchestrationEnabled: false,
    trends,
    topRisks,
    snapshot,
    primaryForecastKo: highTrend
      ? `${highTrend.labelKo}: ${highTrend.noteKo}`
      : "forecast trend stable — read-only planning 유지",
    orchestrationSaturationRiskKo:
      topRisks.some((r) => r.saturationImplicationKo.includes("상승"))
        ? "orchestration saturation risk 관측 — escalation summary 확인"
        : `governance drift: ${governanceDrift.primaryDriftKo}`,
  };
}

export function serializeRuntimeForecastSummaryForDiagnostic(
  summary: RuntimeForecastSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    trends: summary.trends.map((t) => ({ ...t })),
    topRisks: summary.topRisks.map((r) => ({ ...r })),
    snapshot: { ...summary.snapshot },
    primaryForecastKo: summary.primaryForecastKo,
    orchestrationSaturationRiskKo: summary.orchestrationSaturationRiskKo,
  };
}
