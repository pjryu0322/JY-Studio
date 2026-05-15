/**
 * H17.5 — reasoning raw trace 수집(중복 quality·audit 입력).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";

export function collectRawReasoningTraceItems(
  reasoningReports: RuntimeReasoningPlanningReports
): readonly string[] {
  const { unifiedReasoningChain, normalizedReasoningTrace } = reasoningReports;
  return [
    ...unifiedReasoningChain.stableOrdering,
    ...normalizedReasoningTrace.normalizedDependencyTraces,
    ...normalizedReasoningTrace.normalizedPriorityTraces,
    ...unifiedReasoningChain.criticalTransitions,
  ];
}

export function collectVisibleSemanticTraceItems(input: {
  readonly compressedReasoningTrace: { compressedLines: readonly string[] };
  readonly semanticGroupsSummary: { groups: readonly { compressedItems: readonly string[] }[] };
  readonly stabilizedSemanticOrdering: { orderedCompressedLines: readonly string[] };
}): readonly string[] {
  return [
    ...input.compressedReasoningTrace.compressedLines,
    ...input.stabilizedSemanticOrdering.orderedCompressedLines,
    ...input.semanticGroupsSummary.groups.flatMap((g) => g.compressedItems),
  ];
}

export function dedupeTraceKeys(items: readonly string[]): Set<string> {
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen;
}
