/**
 * H20.5 — token·provider·queue·routing·parallel·orchestration **pressure** 분석(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { RUNTIME_RESOURCE_PRESSURE_LABEL_KO } from "./runtimeResourceLabelsKo";
import type { RuntimeResourcePressure, RuntimeResourcePressureKind } from "./runtimeResourceTypes";
import { compareRuntimeResourcePressureBySeverityDesc } from "./runtimeResourceSeverityOrder";

const MAX_PRESSURES = 6;

function pressure(
  kind: RuntimeResourcePressureKind,
  severity: RuntimeResourcePressure["severity"],
  noteKo: string
): RuntimeResourcePressure {
  return {
    kind,
    severity,
    labelKo: RUNTIME_RESOURCE_PRESSURE_LABEL_KO[kind],
    noteKo,
  };
}

export function analyzeRuntimeResourcePressure(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): readonly RuntimeResourcePressure[] {
  const pressures: RuntimeResourcePressure[] = [];
  const quality = reports.compressionQualityReport.quality;
  const traceCount = reports.compressedReasoningTrace.compressedItemCount;
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const warningCount = reports.semanticWarningOriginSummary.origins.length;
  const criticalPaths = reports.semanticGraphRelevanceSummary.rankedPaths.filter(
    (p) => p.severity === "critical_candidate"
  ).length;
  const coherence = reports.runtimeDecisionCoherence.overallLevel;
  const forecastOutlook = reports.runtimeForecastStability.outlook;

  if (quality !== "safe" || traceCount > 12) {
    pressures.push(
      pressure(
        "token_pressure",
        traceCount > 20 ? "high" : "medium",
        `compression=${quality}, trace items=${traceCount}`
      )
    );
  } else {
    pressures.push(pressure("token_pressure", "low", "token pressure 신호 안정"));
  }

  if (explosion !== "low" || forecastOutlook === "degrading" || forecastOutlook === "critical_candidate") {
    pressures.push(
      pressure(
        "provider_saturation",
        explosion === "high" ? "high" : "medium",
        `explosion=${explosion}, forecast stability=${forecastOutlook}`
      )
    );
  } else {
    pressures.push(pressure("provider_saturation", "low", "provider saturation 제한적"));
  }

  if (
    reports.runtimeForecastSummary.orchestrationSaturationRiskKo.includes("상승") ||
    reports.runtimeForecastEscalation.chains.some((c) => c.includes("saturation"))
  ) {
    pressures.push(pressure("queue_overload", "high", "forecast saturation·escalation queue 신호"));
  } else {
    pressures.push(pressure("queue_overload", "low", "queue overload 신호 낮음"));
  }

  if (criticalPaths > 0 || reports.runtimeRecommendationSummary.recommendations.some((r) => r.kind === "routing_ambiguity")) {
    pressures.push(
      pressure("routing_congestion", criticalPaths > 1 ? "high" : "medium", `critical paths=${criticalPaths}`)
    );
  } else {
    pressures.push(pressure("routing_congestion", "low", "routing congestion 낮음"));
  }

  if (reports.compressedReasoningTrace.compressedLines.length > 8) {
    pressures.push(
      pressure(
        "parallel_execution_pressure",
        reports.compressedReasoningTrace.compressedLines.length > 14 ? "high" : "medium",
        "compressed reasoning trace depth 증가"
      )
    );
  } else {
    pressures.push(pressure("parallel_execution_pressure", "low", "parallel execution pressure 안정"));
  }

  if (coherence !== "aligned") {
    pressures.push(
      pressure(
        "orchestration_congestion",
        coherence === "divergent" ? "high" : "medium",
        `decision coherence=${coherence}`
      )
    );
  } else {
    pressures.push(pressure("orchestration_congestion", "low", "orchestration congestion 낮음"));
  }

  return pressures.sort(compareRuntimeResourcePressureBySeverityDesc).slice(0, MAX_PRESSURES);
}

export function serializeRuntimeResourcePressuresForDiagnostic(
  pressures: readonly RuntimeResourcePressure[]
): Readonly<Record<string, unknown>> {
  return { pressures: pressures.map((p) => ({ ...p })) };
}
