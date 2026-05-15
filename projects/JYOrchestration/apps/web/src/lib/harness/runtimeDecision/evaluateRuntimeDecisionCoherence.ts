/**
 * H19.5 — cross-layer **decision coherence** 평가(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeDecision } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeDecisionCoherence,
  RuntimeDecisionCoherenceDimension,
} from "./runtimeDecisionTypes";

function levelFromSignals(
  aligned: boolean,
  partial: boolean
): "aligned" | "partial" | "divergent" {
  if (aligned) return "aligned";
  if (partial) return "partial";
  return "divergent";
}

export function evaluateRuntimeDecisionCoherence(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticPlanningReportsBeforeDecision
): RuntimeDecisionCoherence {
  const quality = semanticReports.compressionQualityReport.quality;
  const explosion = semanticReports.semanticExplosionRiskSummary.explosionRisk;
  const hasCriticalReasoning = reasoningReports.unifiedReasoningChain.criticalTransitions.length > 0;

  const dimensions: RuntimeDecisionCoherence["dimensions"] = [
    {
      dimension: "governance",
      level: levelFromSignals(
        semanticReports.hiddenTraceAudit.hiddenGovernanceWarningCount === 0,
        semanticReports.hiddenTraceAudit.hiddenGovernanceWarningCount <= 1
      ),
      noteKo:
        semanticReports.hiddenTraceAudit.hiddenGovernanceWarningCount > 0
          ? "governance hidden trace 신호 존재"
          : "governance planning 신호 안정",
    },
    {
      dimension: "semantic",
      level: levelFromSignals(quality === "safe" && explosion === "low", quality !== "over_compressed"),
      noteKo: `semantic quality=${quality}, explosion=${explosion}`,
    },
    {
      dimension: "reasoning",
      level: levelFromSignals(!hasCriticalReasoning, !hasCriticalReasoning || explosion !== "high"),
      noteKo: hasCriticalReasoning ? "reasoning critical transition 관측" : "reasoning chain 안정",
    },
    {
      dimension: "routing",
      level: levelFromSignals(
        semanticReports.semanticGraphRelevanceSummary.rankedPaths.every((r) => r.severity !== "critical_candidate"),
        true
      ),
      noteKo: semanticReports.semanticGraphRelevanceSummary.warningCollapseSummaryKo,
    },
    {
      dimension: "lifecycle",
      level: "aligned",
      noteKo: "lifecycle governance는 read-only planning 범위에서 neutral",
    },
    {
      dimension: "explainability",
      level: levelFromSignals(
        semanticReports.semanticNarrativeSummary.narratives.length > 0,
        semanticReports.semanticVocabularySummary.groups.length > 0
      ),
      noteKo: "narrative·vocabulary explainability 경로 연결",
    },
  ] satisfies ReadonlyArray<{
    dimension: RuntimeDecisionCoherenceDimension;
    level: "aligned" | "partial" | "divergent";
    noteKo: string;
  }>;

  const divergentCount = dimensions.filter((d) => d.level === "divergent").length;
  const partialCount = dimensions.filter((d) => d.level === "partial").length;
  const overallLevel: RuntimeDecisionCoherence["overallLevel"] =
    divergentCount >= 2 ? "divergent" : partialCount >= 2 || divergentCount === 1 ? "partial" : "aligned";

  return {
    mode: "runtime_decision_coherence",
    actualRuntimeOrchestrationEnabled: false,
    overallLevel,
    dimensions,
    findings: [
      overallLevel !== "aligned"
        ? "cross-layer decision coherence가 완전히 정렬되지 않았습니다."
        : "governance·semantic·reasoning·routing 신호가 aligned입니다.",
    ],
    recommendations: [
      "Decision coherence는 enforcement 없이 planning 정렬만 평가합니다.",
      overallLevel === "divergent"
        ? "recommendation summary와 lineage primary path를 먼저 확인하세요."
        : "현재 orchestration decision coherence는 관측 범위에서 안정적입니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeDecisionCoherenceForDiagnostic(
  coherence: RuntimeDecisionCoherence
): Readonly<Record<string, unknown>> {
  return {
    mode: coherence.mode,
    actualRuntimeOrchestrationEnabled: coherence.actualRuntimeOrchestrationEnabled,
    overallLevel: coherence.overallLevel,
    dimensions: coherence.dimensions.map((d) => ({ ...d })),
    findings: [...coherence.findings],
    recommendations: [...coherence.recommendations],
  };
}
