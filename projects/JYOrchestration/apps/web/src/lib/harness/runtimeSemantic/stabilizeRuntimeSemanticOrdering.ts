/**
 * H17 — semantic **ordering stabilization**(read-only).
 */

import type { RuntimeSemanticGroupsSummary } from "./runtimeSemanticTypes";
import type { CompressedRuntimeReasoningTrace, StabilizedRuntimeSemanticOrdering } from "./runtimeSemanticTypes";
import { compareSemanticKinds } from "./runtimeSemanticKindUtils";

export function stabilizeRuntimeSemanticOrdering(
  groupsSummary: RuntimeSemanticGroupsSummary,
  compressedTrace: CompressedRuntimeReasoningTrace
): StabilizedRuntimeSemanticOrdering {
  const orderedGroupLabels = [...groupsSummary.groups]
    .sort((a, b) => compareSemanticKinds(a.kind, b.kind))
    .map((g) => g.labelKo);

  const orderedCompressedLines = [...compressedTrace.compressedLines].sort((a, b) => {
    const prefix = (s: string) => s.match(/^\[([^\]]+)\]/)?.[1] ?? "";
    const ia = orderedGroupLabels.indexOf(prefix(a));
    const ib = orderedGroupLabels.indexOf(prefix(b));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  const recommendations: string[] = [
    "Stabilized semantic ordering은 overlay 렌더 순서 힌트만 제공합니다.",
    orderedCompressedLines.length >= 6
      ? "stable group → compressed line 순으로 compact trace를 표시하세요."
      : "semantic ordering이 관측 범위에서 단순합니다.",
  ];

  return {
    mode: "stabilized_runtime_semantic_ordering",
    actualRuntimeOrchestrationEnabled: false,
    orderedGroupLabels: [...new Set(orderedGroupLabels)],
    orderedCompressedLines,
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeStabilizedRuntimeSemanticOrderingForDiagnostic(
  ordering: StabilizedRuntimeSemanticOrdering
): Readonly<Record<string, unknown>> {
  return {
    mode: ordering.mode,
    actualRuntimeOrchestrationEnabled: ordering.actualRuntimeOrchestrationEnabled,
    orderedGroupLabels: [...ordering.orderedGroupLabels],
    orderedCompressedLines: [...ordering.orderedCompressedLines],
    recommendations: [...ordering.recommendations],
  };
}
