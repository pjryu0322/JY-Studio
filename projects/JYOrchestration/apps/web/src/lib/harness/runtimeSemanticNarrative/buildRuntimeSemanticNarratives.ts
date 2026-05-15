/**
 * H18.5 — graph·root-cause 기반 **deterministic narrative**(read-only, LLM 없음).
 */

import type {
  RuntimeSemanticGraphRelevanceSummary,
  RuntimeSemanticNarrative,
  RuntimeSemanticNarrativeSeverity,
  RuntimeSemanticNarrativeSummary,
  RuntimeSemanticRootCauseGroup,
  RuntimeSemanticRootCauseKind,
} from "./runtimeSemanticNarrativeTypes";

const MAX_NARRATIVES = 6;

function severityForKind(kind: RuntimeSemanticRootCauseKind): RuntimeSemanticNarrativeSeverity {
  switch (kind) {
    case "dependency_conflict":
    case "hidden_trace":
    case "governance_conflict":
      return "critical_candidate";
    case "propagation_escalation":
    case "compression_quality":
    case "reasoning_explosion":
      return "watch";
    default:
      return "info";
  }
}

function narrativeKoForGroup(group: RuntimeSemanticRootCauseGroup, criticalPath: string): string {
  const chain = group.primaryChain.join(" → ");
  switch (group.kind) {
    case "dependency_conflict":
      return `Dependency conflict가 propagation escalation으로 이어졌고, semantic compression 과정에서 trace가 압축되어 quality 신호가 발생했습니다. (관련: ${criticalPath.slice(0, 80)})`;
    case "propagation_escalation":
      return `Impact propagation escalation이 semantic grouping·compression 순서로 전달되었습니다. (${chain})`;
    case "governance_conflict":
      return `Governance trace 일부가 semantic compression에서 숨겨져 planning quality warning이 발생했습니다. (${chain})`;
    case "hidden_trace":
      return `Critical transition trace가 compressed reasoning path에서 생략되어 hidden audit 경고가 기록되었습니다. (${chain})`;
    case "compression_quality":
      return `Semantic compression 품질이 safe가 아니며, propagation·group balance 신호와 함께 관측됩니다. (${chain})`;
    case "group_imbalance":
      return `Semantic group 분포가 불균형하여 dominant group이 narrative·ranking을 왜곡할 수 있습니다. (${chain})`;
    case "reasoning_explosion":
      return `Reasoning explosion risk가 semantic compression·overlay mapping 경로에 반영되었습니다. (${chain})`;
    case "stable_planning":
      return `현재 관측 범위에서 semantic planning 경로는 안정적이며, causal narrative는 참고용 metadata입니다. (${chain})`;
    default:
      return `Planning semantic 경로: ${chain}`;
  }
}

export function buildRuntimeSemanticNarratives(
  rootCauseGroups: readonly RuntimeSemanticRootCauseGroup[],
  relevance: RuntimeSemanticGraphRelevanceSummary
): RuntimeSemanticNarrativeSummary {
  const seenNarrative = new Set<string>();
  const narratives: RuntimeSemanticNarrative[] = [];

  for (const group of rootCauseGroups) {
    const text = narrativeKoForGroup(group, relevance.criticalPath);
    if (seenNarrative.has(text)) continue;
    seenNarrative.add(text);
    narratives.push({
      id: `narrative-${group.kind}`,
      severity: severityForKind(group.kind),
      narrativeKo: text,
      rootCauseKind: group.kind,
      relatedPath: relevance.criticalPath,
    });
    if (narratives.length >= MAX_NARRATIVES) break;
  }

  for (const ranked of relevance.rankedPaths) {
    if (narratives.length >= MAX_NARRATIVES) break;
    if (narratives.some((n) => n.relatedPath === ranked.path)) continue;
    const text = `Causal path 우선순위: ${ranked.path}`;
    if (seenNarrative.has(text)) continue;
    seenNarrative.add(text);
    narratives.push({
      id: `path-${narratives.length}`,
      severity: ranked.severity,
      narrativeKo: text,
      rootCauseKind: "stable_planning",
      relatedPath: ranked.path,
    });
  }

  const collapsedDuplicateWarnings = rootCauseGroups.reduce((sum, g) => sum + g.collapsedWarningCount, 0);

  return {
    mode: "runtime_semantic_narrative_summary",
    actualRuntimeOrchestrationEnabled: false,
    narratives: narratives.slice(0, MAX_NARRATIVES),
    topNarrativeKo: narratives[0]?.narrativeKo ?? "—",
    collapsedDuplicateWarnings,
    recommendations: [
      "Narrative는 rule-based planning 설명이며 LLM·enforcement를 호출하지 않습니다.",
      collapsedDuplicateWarnings > 0
        ? "root-cause consolidation으로 중복 warning 표시를 줄였습니다."
        : "현재 narrative drift·중복이 낮습니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeSemanticNarrativeSummaryForDiagnostic(
  summary: RuntimeSemanticNarrativeSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    narratives: summary.narratives.map((n) => ({ ...n })),
    topNarrativeKo: summary.topNarrativeKo,
    collapsedDuplicateWarnings: summary.collapsedDuplicateWarnings,
    recommendations: [...summary.recommendations],
  };
}
