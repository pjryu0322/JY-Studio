/**
 * H20.5 — future **resource capacity** forecast(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeResourceCapacity, RuntimeResourceCapacityOutlook, RuntimeResourceForecast } from "./runtimeResourceTypes";

const MAX_PREDICTIONS = 4;

function uniquePredictions(candidates: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const key = c.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_PREDICTIONS) break;
  }
  return out;
}

function outlookFromSignals(
  explosion: "low" | "medium" | "high",
  forecastOutlook: "stable" | "watch" | "degrading" | "critical_candidate"
): RuntimeResourceCapacityOutlook {
  if (explosion === "high" || forecastOutlook === "critical_candidate") return "exhaustion_candidate";
  if (explosion === "medium" || forecastOutlook === "degrading") return "strained";
  if (forecastOutlook === "watch") return "tight";
  return "comfortable";
}

export function forecastRuntimeResourceCapacity(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeResourceCapacity {
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const forecastOutlook = reports.runtimeForecastStability.outlook;
  const outlook = outlookFromSignals(explosion, forecastOutlook);

  const findings: string[] = [];
  if (outlook === "exhaustion_candidate" || outlook === "strained") {
    findings.push("future capacity exhaustion 또는 queue overload 가능성이 있습니다.");
  } else {
    findings.push("resource capacity는 planning 관측 범위에서 안정적입니다.");
  }

  return {
    mode: "runtime_resource_capacity",
    actualRuntimeOrchestrationEnabled: false,
    outlook,
    bottleneckLabelKo:
      outlook === "comfortable"
        ? "orchestration bottleneck 제한적"
        : "semantic·forecast pressure → resource bottleneck 가능",
    findings: findings.slice(0, 3),
  };
}

export function buildRuntimeResourceForecastFromCapacity(
  capacity: RuntimeResourceCapacity,
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeResourceForecast {
  const candidates: string[] = [];
  if (capacity.outlook === "exhaustion_candidate" || capacity.outlook === "strained") {
    candidates.push("future provider exhaustion 가능");
    candidates.push("forecasted queue overload 가능");
  }
  if (reports.runtimeForecastEscalation.primaryChainKo.includes("saturation")) {
    candidates.push("orchestration saturation → resource starvation 경로");
  }
  if (candidates.length === 0) {
    candidates.push("resource capacity stable — low overload forecast");
  }
  candidates.push("future orchestration bottleneck — planning metadata only");

  const predictions = uniquePredictions(candidates);

  return {
    mode: "runtime_resource_forecast",
    actualRuntimeOrchestrationEnabled: false,
    predictions,
    primaryPredictionKo: predictions[0] ?? "stable resource forecast",
  };
}

export function serializeRuntimeResourceCapacityForDiagnostic(
  capacity: RuntimeResourceCapacity
): Readonly<Record<string, unknown>> {
  return {
    mode: capacity.mode,
    actualRuntimeOrchestrationEnabled: capacity.actualRuntimeOrchestrationEnabled,
    outlook: capacity.outlook,
    bottleneckLabelKo: capacity.bottleneckLabelKo,
    findings: [...capacity.findings],
  };
}

export function serializeRuntimeResourceForecastForDiagnostic(
  forecast: RuntimeResourceForecast
): Readonly<Record<string, unknown>> {
  return {
    mode: forecast.mode,
    actualRuntimeOrchestrationEnabled: forecast.actualRuntimeOrchestrationEnabled,
    predictions: [...forecast.predictions],
    primaryPredictionKo: forecast.primaryPredictionKo,
  };
}
