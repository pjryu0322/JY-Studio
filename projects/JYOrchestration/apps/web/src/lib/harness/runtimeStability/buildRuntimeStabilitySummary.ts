/**
 * H12 — runtime enforcement **planning stability** 요약(read-only).
 */

import type { GovernanceRiskSummary } from "@/lib/harness/enforcementGovernance/controlledEnforcementGovernanceTypes";
import type { RuntimeEnforcementRiskSummary } from "@/lib/harness/runtimeEnforcement/runtimeEnforcementCandidateTypes";
import type { RuntimeRiskSummaryWire } from "@/lib/harness/runtimeTrial/runtimeTrialTypes";
import type {
  CandidateSaturationLevel,
  CandidateSaturationSummary,
  RuntimeCandidateConflictReport,
  RuntimeStabilityLevel,
  RuntimeStabilitySummary,
} from "./runtimeStabilityTypes";

function mapConflictSeverityToStability(
  severity: RuntimeCandidateConflictReport["severity"]
): RuntimeStabilityLevel {
  if (severity === "high") return "unstable";
  if (severity === "medium") return "elevated";
  return "watch";
}

function mapRiskLevel(
  level: "stable" | "watch" | "elevated" | "high"
): RuntimeStabilityLevel {
  if (level === "high") return "unstable";
  if (level === "elevated") return "elevated";
  if (level === "watch") return "watch";
  return "stable";
}

export function buildRuntimeStabilitySummary(input: {
  readonly conflictReport: RuntimeCandidateConflictReport;
  readonly saturationSummary: CandidateSaturationSummary;
  readonly enforcementRisk: RuntimeEnforcementRiskSummary;
  readonly governanceRisk: GovernanceRiskSummary;
  readonly runtimeRisk: RuntimeRiskSummaryWire;
}): RuntimeStabilitySummary {
  const riskFactors: string[] = [];
  let stabilityLevel: RuntimeStabilityLevel = "stable";
  const bump = (next: RuntimeStabilityLevel) => {
    const order: RuntimeStabilityLevel[] = ["stable", "watch", "elevated", "unstable"];
    if (order.indexOf(next) > order.indexOf(stabilityLevel)) stabilityLevel = next;
  };

  bump(mapConflictSeverityToStability(input.conflictReport.severity));
  if (input.saturationSummary.saturationLevel === "high") bump("unstable");
  else if (input.saturationSummary.saturationLevel === "medium") bump("elevated");

  bump(mapRiskLevel(input.enforcementRisk.enforcementRiskLevel));
  bump(mapRiskLevel(input.governanceRisk.governanceRiskLevel));
  if (input.runtimeRisk.overallRiskLabelKo === "높음") {
    bump("elevated");
  }
  if (
    input.runtimeRisk.resourcePressureSeverity === "critical" ||
    input.runtimeRisk.resourcePressureSeverity === "high"
  ) {
    bump(input.runtimeRisk.resourcePressureSeverity === "critical" ? "unstable" : "elevated");
  }

  riskFactors.push(...input.conflictReport.conflicts.map((c) => c.noteKo).slice(0, 4));
  riskFactors.push(...input.saturationSummary.factorNotesKo.slice(0, 3));
  riskFactors.push(...input.enforcementRisk.factorNotesKo.slice(0, 2));
  riskFactors.push(...input.governanceRisk.factorNotesKo.slice(0, 2));

  const criticalDependencies: string[] = [];
  for (const c of input.conflictReport.conflicts) {
    if (c.severity === "high") criticalDependencies.push(c.labelKo);
  }
  if (criticalDependencies.length === 0 && input.conflictReport.recommendedCandidates.length > 0) {
    criticalDependencies.push(
      `권장 후보(메타): ${input.conflictReport.recommendedCandidates.slice(0, 3).join(", ")}`
    );
  }

  const recommendations: string[] = [
    "H12는 enforcement candidate orchestration stability만 분석합니다. 실제 enforcement·라우팅·rollback은 없습니다.",
    "충돌·포화가 높으면 H11 후보를 planning_only로 유지하고 Overlay compact·접힘을 우선하세요.",
  ];
  const stabilityOrder: RuntimeStabilityLevel[] = ["stable", "watch", "elevated", "unstable"];
  if (stabilityOrder.indexOf(stabilityLevel) >= stabilityOrder.indexOf("elevated")) {
    recommendations.unshift("현재 planning stability가 낮습니다 — 후보 동시 활성화를 문서화하지 마세요.");
  }

  const saturationLevel: CandidateSaturationLevel = input.saturationSummary.saturationLevel;

  return {
    mode: "runtime_stability_summary",
    actualRuntimeEnforcementEnabled: false,
    stabilityLevel,
    riskFactors: [...new Set(riskFactors)].slice(0, 12),
    saturationLevel,
    criticalDependencies: criticalDependencies.slice(0, 8),
    recommendations: recommendations.slice(0, 8),
  };
}

export function serializeRuntimeStabilitySummaryForDiagnostic(
  summary: RuntimeStabilitySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeEnforcementEnabled: summary.actualRuntimeEnforcementEnabled,
    stabilityLevel: summary.stabilityLevel,
    riskFactors: [...summary.riskFactors],
    saturationLevel: summary.saturationLevel,
    criticalDependencies: [...summary.criticalDependencies],
    recommendations: [...summary.recommendations],
  };
}
