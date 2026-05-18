/**
 * H20 — future **escalation chain** 예측(read-only, deduped).
 */

import type { RuntimeSemanticPlanningReportsBeforeForecast } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeForecastEscalation } from "./runtimeForecastTypes";

const MAX_CHAINS = 5;

const CANONICAL_ESCALATION =
  "semantic explosion → governance instability → routing ambiguity → orchestration saturation";

function uniqueChains(candidates: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const normalized = c.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(c);
    if (out.length >= MAX_CHAINS) break;
  }
  return out;
}

export function predictRuntimeEscalationChains(
  reports: RuntimeSemanticPlanningReportsBeforeForecast
): RuntimeForecastEscalation {
  const candidates: string[] = [];
  const explosion = reports.semanticExplosionRiskSummary.explosionRisk;
  const coherence = reports.runtimeDecisionCoherence.overallLevel;

  if (explosion !== "low") {
    candidates.push(CANONICAL_ESCALATION);
  }
  if (reports.compressionQualityReport.quality !== "safe") {
    candidates.push(
      "semantic compression stress → vocabulary drift → governance review escalation"
    );
  }
  if (reports.hiddenTraceAudit.hiddenGovernanceWarningCount > 0) {
    candidates.push(
      "governance hidden trace → decision lineage divergence → routing instability"
    );
  }
  if (reports.runtimeRecommendationSummary.recommendations.some((r) => r.severity === "critical_candidate")) {
    candidates.push(
      "critical recommendation → warning amplification → orchestration saturation risk"
    );
  }
  if (coherence === "divergent") {
    candidates.push(
      "coherence divergent → semantic narrative overload → future instability"
    );
  }
  if (candidates.length === 0) {
    candidates.push("stable planning → low escalation → maintain read-only observability");
  }

  const chains = uniqueChains(candidates);
  const highRiskFirst = [...chains].sort((a, b) => {
    const score = (s: string) =>
      (s.includes("saturation") ? 4 : 0) +
      (s.includes("critical") ? 3 : 0) +
      (s.includes("governance") ? 2 : 0) +
      (s.includes("explosion") ? 2 : 0);
    return score(b) - score(a);
  });

  return {
    mode: "runtime_forecast_escalation",
    actualRuntimeOrchestrationEnabled: false,
    chains,
    primaryChainKo: highRiskFirst[0] ?? chains[0] ?? CANONICAL_ESCALATION,
    highRiskFirst: highRiskFirst.slice(0, MAX_CHAINS),
  };
}

export function serializeRuntimeForecastEscalationForDiagnostic(
  escalation: RuntimeForecastEscalation
): Readonly<Record<string, unknown>> {
  return {
    mode: escalation.mode,
    actualRuntimeOrchestrationEnabled: escalation.actualRuntimeOrchestrationEnabled,
    chains: [...escalation.chains],
    primaryChainKo: escalation.primaryChainKo,
    highRiskFirst: [...escalation.highRiskFirst],
  };
}
