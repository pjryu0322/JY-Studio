/**
 * H20 — longitudinal **stability forecast**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeForecast } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeForecastStability, RuntimeForecastStabilityOutlook } from "./runtimeForecastTypes";

function outlookFromSignals(
  coherence: "aligned" | "partial" | "divergent",
  explosion: "low" | "medium" | "high",
  quality: "safe" | "watch" | "over_compressed" | "under_compressed"
): RuntimeForecastStabilityOutlook {
  if (coherence === "divergent" || explosion === "high") return "critical_candidate";
  if (coherence === "partial" || explosion === "medium" || quality === "over_compressed") return "degrading";
  if (quality === "watch" || quality === "under_compressed") return "watch";
  return "stable";
}

export function evaluateRuntimeForecastStability(
  reports: RuntimeSemanticPlanningReportsBeforeForecast
): RuntimeForecastStability {
  const coherence = reports.runtimeDecisionCoherence.overallLevel;
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const quality = reports.compressionQualityReport.quality;
  const outlook = outlookFromSignals(coherence, explosion, quality);

  const findings: string[] = [];
  if (outlook !== "stable") {
    findings.push("현재 coherence가 future runtime instability로 이어질 가능성이 있습니다.");
  } else {
    findings.push("longitudinal orchestration stability는 관측 범위에서 안정적입니다.");
  }
  if (reports.runtimeDecisionLineage.lineagePaths.length > 2) {
    findings.push("decision lineage 경로 증가 — stability watch 권장.");
  }

  return {
    mode: "runtime_forecast_stability",
    actualRuntimeOrchestrationEnabled: false,
    outlook,
    longitudinalNoteKo: `coherence=${coherence}, explosion=${explosion}, quality=${quality}`,
    coherenceDriftRiskKo:
      coherence === "aligned"
        ? "coherence drift risk 낮음"
        : `coherence ${coherence} — drift toward instability 가능`,
    findings: findings.slice(0, 4),
  };
}

export function serializeRuntimeForecastStabilityForDiagnostic(
  stability: RuntimeForecastStability
): Readonly<Record<string, unknown>> {
  return {
    mode: stability.mode,
    actualRuntimeOrchestrationEnabled: stability.actualRuntimeOrchestrationEnabled,
    outlook: stability.outlook,
    longitudinalNoteKo: stability.longitudinalNoteKo,
    coherenceDriftRiskKo: stability.coherenceDriftRiskKo,
    findings: [...stability.findings],
  };
}
