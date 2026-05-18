/**
 * H18 — semantic **explosion** 위험 평가(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticExplosionRisk, RuntimeSemanticExplosionRiskSummary } from "./runtimeSemanticGraphTypes";

export function evaluateRuntimeSemanticExplosionRisk(
  semanticReports: RuntimeSemanticCorePlanningReports
): RuntimeSemanticExplosionRiskSummary {
  const {
    semanticGroupsSummary,
    compressedReasoningTrace,
    compressionQualityReport,
    hiddenTraceAudit,
    semanticRedundancySummary,
    semanticGroupBalanceSummary,
  } = semanticReports;

  const semanticGroupCount = semanticGroupsSummary.groups.length;
  const compressedLineCount = compressedReasoningTrace.compressedLines.length;
  const warningCascadeCount =
    compressionQualityReport.findings.filter((f) => f.severity === "warning").length +
    hiddenTraceAudit.findings.filter((f) => f.severity === "warning").length;

  const findings: string[] = [];
  let explosionRisk: RuntimeSemanticExplosionRisk = "low";

  if (semanticGroupCount >= 5 && compressedLineCount >= 6) {
    explosionRisk = "medium";
    findings.push("semantic group·compressed line 동시 증가 — graph node explosion 위험.");
  }

  if (semanticRedundancySummary.reasoningExplosionRisk !== "low" && warningCascadeCount >= 2) {
    explosionRisk = "high";
    findings.push("reasoning explosion + warning cascade — semantic explosion 위험.");
  }

  if (hiddenTraceAudit.hiddenTraceCount >= 6) {
    explosionRisk = explosionRisk === "low" ? "medium" : explosionRisk;
    findings.push("hidden trace 누적 — duplicate hidden scan 완화 필요.");
  }

  if (semanticGroupBalanceSummary.otherGroupSharePercent >= 40) {
    findings.push("other group fragmentation — group overlap 점검.");
  }

  findings.push("Explosion risk는 read-only observability 힌트입니다. actual orchestration 없음.");

  const recommendations: string[] = [
    explosionRisk === "high"
      ? "causal path 최대 5개·compact graph collapse로 overlay expansion을 제한하세요."
      : "현재 semantic explosion risk는 관측 범위에서 안정적입니다.",
  ];

  return {
    mode: "runtime_semantic_explosion_risk_summary",
    actualRuntimeOrchestrationEnabled: false,
    explosionRisk,
    semanticGroupCount,
    compressedLineCount,
    warningCascadeCount,
    findings: findings.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticExplosionRiskSummaryForDiagnostic(
  summary: RuntimeSemanticExplosionRiskSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    explosionRisk: summary.explosionRisk,
    semanticGroupCount: summary.semanticGroupCount,
    compressedLineCount: summary.compressedLineCount,
    warningCascadeCount: summary.warningCascadeCount,
    findings: [...summary.findings],
    recommendations: [...summary.recommendations],
  };
}
