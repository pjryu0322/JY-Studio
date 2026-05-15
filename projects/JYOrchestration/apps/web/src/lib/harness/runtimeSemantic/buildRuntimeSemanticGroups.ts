/**
 * H17 — reasoning을 **semantic groups**로 묶음(read-only; H16.5 reports 재사용).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticGroup, RuntimeSemanticGroupKind, RuntimeSemanticGroupsSummary } from "./runtimeSemanticTypes";
import {
  compareSemanticKinds,
  parseSemanticKindFromStep,
  semanticGroupLabelKo,
} from "./runtimeSemanticKindUtils";

function pushToMap(map: Map<RuntimeSemanticGroupKind, string[]>, kind: RuntimeSemanticGroupKind, item: string): void {
  const key = item.trim();
  if (!key) return;
  const list = map.get(kind) ?? [];
  if (!list.some((x) => x.toLowerCase() === key.toLowerCase())) list.push(key);
  map.set(kind, list);
}

export function buildRuntimeSemanticGroups(
  reasoningReports: RuntimeReasoningPlanningReports
): RuntimeSemanticGroupsSummary {
  const { unifiedReasoningChain, normalizedReasoningTrace } = reasoningReports;
  const byKind = new Map<RuntimeSemanticGroupKind, string[]>();

  for (const step of unifiedReasoningChain.stableOrdering) {
    const kind = parseSemanticKindFromStep(step);
    pushToMap(byKind, kind, step);
  }
  for (const line of normalizedReasoningTrace.normalizedDependencyTraces) {
    pushToMap(byKind, "propagation", line);
  }
  for (const line of normalizedReasoningTrace.normalizedPriorityTraces) {
    pushToMap(byKind, "criticality", line);
  }
  for (const t of unifiedReasoningChain.criticalTransitions) {
    pushToMap(byKind, "criticality", t);
  }

  const groups: RuntimeSemanticGroup[] = [...byKind.entries()]
    .map(([kind, items]) => ({
      kind,
      labelKo: semanticGroupLabelKo(kind),
      compressedItems: items.slice(0, 4),
    }))
    .sort((a, b) => compareSemanticKinds(a.kind, b.kind));

  const totalItemCount =
    unifiedReasoningChain.stableOrdering.length +
    normalizedReasoningTrace.normalizedDependencyTraces.length +
    normalizedReasoningTrace.normalizedPriorityTraces.length +
    unifiedReasoningChain.criticalTransitions.length;
  const compressedCount = groups.reduce((n, g) => n + g.compressedItems.length, 0);
  const ratio =
    totalItemCount > 0 ? `${Math.min(100, Math.round((compressedCount / totalItemCount) * 100))}%` : "—";

  const recommendations: string[] = [
    "Semantic groups는 overlay-safe planning 메타만 압축합니다. payload 변경 없음.",
    groups.length > 4
      ? "compact·narrow UI에서는 semantic 섹션만 우선 표시하세요."
      : "semantic grouping 후 reasoning explosion 위험이 낮습니다.",
  ];

  return {
    mode: "runtime_semantic_groups_summary",
    actualRuntimeOrchestrationEnabled: false,
    groups,
    totalItemCount,
    compressionRatioLabel: ratio,
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticGroupsSummaryForDiagnostic(
  summary: RuntimeSemanticGroupsSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    groups: summary.groups.map((g) => ({
      kind: g.kind,
      labelKo: g.labelKo,
      compressedItems: [...g.compressedItems],
    })),
    totalItemCount: summary.totalItemCount,
    compressionRatioLabel: summary.compressionRatioLabel,
    recommendations: [...summary.recommendations],
  };
}
