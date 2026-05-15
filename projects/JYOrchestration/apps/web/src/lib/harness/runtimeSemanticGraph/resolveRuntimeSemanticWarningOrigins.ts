/**
 * H18 — semantic **warning origin** 추적(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticWarningOrigin, RuntimeSemanticWarningOriginSummary } from "./runtimeSemanticGraphTypes";

export function resolveRuntimeSemanticWarningOrigins(
  semanticReports: RuntimeSemanticCorePlanningReports
): RuntimeSemanticWarningOriginSummary {
  const origins: RuntimeSemanticWarningOrigin[] = [];
  const { compressionQualityReport, hiddenTraceAudit, semanticGroupBalanceSummary, semanticRedundancySummary } =
    semanticReports;

  for (const f of compressionQualityReport.findings) {
    if (f.severity !== "warning") continue;
    origins.push({
      warningCode: f.code,
      originChain: [
        "compression quality",
        hiddenTraceAudit.hiddenGovernanceWarningCount > 0
          ? "hidden governance trace"
          : "semantic compression",
        "propagation chain",
      ],
      severity: "warning",
    });
  }

  if (hiddenTraceAudit.hiddenCriticalTransitionCount > 0) {
    origins.push({
      warningCode: "hidden_critical_origin",
      originChain: ["hidden critical transition", "compressed trace", "reasoning chain"],
      severity: "warning",
    });
  }

  if (semanticGroupBalanceSummary.balanceLevel === "imbalanced") {
    origins.push({
      warningCode: "group_imbalance_origin",
      originChain: [
        `dominant group: ${semanticGroupBalanceSummary.dominantGroupKind}`,
        "semantic grouping",
        "reasoning consolidation",
      ],
      severity: "warning",
    });
  }

  if (semanticRedundancySummary.reasoningExplosionRisk !== "low") {
    origins.push({
      warningCode: "reasoning_explosion_origin",
      originChain: ["reasoning explosion", "semantic compression", "overlay mapping"],
      severity: "info",
    });
  }

  const primaryOriginChain =
    origins[0]?.originChain ??
    (compressionQualityReport.quality !== "safe"
      ? ["quality warning", "semantic compression", "planning trace"]
      : ["stable semantic path", "compression", "reasoning"]);

  const recommendations: string[] = [
    "Warning origin은 planning causal metadata만 제공합니다. enforcement 없음.",
    origins.length > 0
      ? "warning-first overlay 정책으로 primary origin chain을 먼저 표시하세요."
      : "현재 관측 범위에서 warning origin이 낮습니다.",
  ];

  return {
    mode: "runtime_semantic_warning_origin_summary",
    actualRuntimeOrchestrationEnabled: false,
    origins: origins.slice(0, 8),
    primaryOriginChain: [...primaryOriginChain].slice(0, 5),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticWarningOriginSummaryForDiagnostic(
  summary: RuntimeSemanticWarningOriginSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    origins: summary.origins.map((o) => ({
      warningCode: o.warningCode,
      originChain: [...o.originChain],
      severity: o.severity,
    })),
    primaryOriginChain: [...summary.primaryOriginChain],
    recommendations: [...summary.recommendations],
  };
}
