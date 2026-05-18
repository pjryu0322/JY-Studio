/**
 * H19 — runtime **priority vocabulary** 통합(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type { RuntimeSemanticNarrativePlanningReports } from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import { RUNTIME_SEMANTIC_PRIORITY_LABEL_KO } from "./runtimeSemanticVocabularyLabelsKo";
import type {
  RuntimeSemanticMeaningLevel,
  RuntimeSemanticPriorityKind,
  RuntimeSemanticPriorityVocabulary,
} from "./runtimeSemanticVocabularyTypes";

type PriorityRow = Readonly<{
  kind: RuntimeSemanticPriorityKind;
  score: number;
  meaningLevel: RuntimeSemanticMeaningLevel;
}>;

export function buildRuntimeSemanticPriorityVocabulary(
  core: RuntimeSemanticCorePlanningReports,
  graph: RuntimeSemanticGraphPlanningReports,
  narrative: RuntimeSemanticNarrativePlanningReports
): RuntimeSemanticPriorityVocabulary {
  const rows: PriorityRow[] = [];

  if (core.hiddenTraceAudit.hiddenGovernanceWarningCount > 0 || core.hiddenTraceAudit.hiddenCriticalTransitionCount > 0) {
    rows.push({
      kind: "governance_criticality",
      score: 90 + core.hiddenTraceAudit.hiddenCriticalTransitionCount * 5,
      meaningLevel: "critical",
    });
  }
  if (graph.semanticExplosionRiskSummary.explosionRisk !== "low") {
    rows.push({
      kind: "semantic_explosion",
      score: graph.semanticExplosionRiskSummary.explosionRisk === "high" ? 85 : 60,
      meaningLevel: graph.semanticExplosionRiskSummary.explosionRisk === "high" ? "critical" : "watch",
    });
  }
  if (core.hiddenTraceAudit.hiddenTraceCount >= 3) {
    rows.push({
      kind: "hidden_trace",
      score: 70 + core.hiddenTraceAudit.hiddenTraceCount,
      meaningLevel: "watch",
    });
  }
  if (core.semanticRedundancySummary.reasoningExplosionRisk !== "low") {
    rows.push({ kind: "dependency_saturation", score: 55, meaningLevel: "watch" });
  }
  if (core.compressionQualityReport.quality !== "safe") {
    rows.push({ kind: "propagation_escalation", score: 50, meaningLevel: "watch" });
  }
  if (narrative.semanticNarrativeSummary.narratives.some((n) => n.severity === "critical_candidate")) {
    rows.push({ kind: "propagation_escalation", score: 65, meaningLevel: "critical" });
  }

  const sorted = rows
    .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))
    .filter((r, i, arr) => arr.findIndex((x) => x.kind === r.kind) === i);

  const priorities =
    sorted.length > 0
      ? sorted.map((r, index) => ({
          kind: r.kind,
          labelKo: RUNTIME_SEMANTIC_PRIORITY_LABEL_KO[r.kind],
          rank: index + 1,
          meaningLevel: r.meaningLevel,
        }))
      : [
          {
            kind: "stable_planning" as const,
            labelKo: RUNTIME_SEMANTIC_PRIORITY_LABEL_KO.stable_planning,
            rank: 1,
            meaningLevel: "info" as const,
          },
        ];

  return {
    mode: "runtime_semantic_priority_vocabulary",
    actualRuntimeOrchestrationEnabled: false,
    priorities,
    topPriorityLabelKo: priorities[0]?.labelKo ?? RUNTIME_SEMANTIC_PRIORITY_LABEL_KO.stable_planning,
    recommendations: [
      "Priority vocabulary는 overlay·narrative 우선순위 정렬용 read-only 메타입니다.",
      priorities[0]?.kind !== "stable_planning"
        ? "governance·explosion·hidden trace 우선순위를 canonical vocabulary로 표시하세요."
        : "현재 planning priority가 안정적입니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeSemanticPriorityVocabularyForDiagnostic(
  vocabulary: RuntimeSemanticPriorityVocabulary
): Readonly<Record<string, unknown>> {
  return {
    mode: vocabulary.mode,
    actualRuntimeOrchestrationEnabled: vocabulary.actualRuntimeOrchestrationEnabled,
    priorities: vocabulary.priorities.map((p) => ({ ...p })),
    topPriorityLabelKo: vocabulary.topPriorityLabelKo,
    recommendations: [...vocabulary.recommendations],
  };
}
