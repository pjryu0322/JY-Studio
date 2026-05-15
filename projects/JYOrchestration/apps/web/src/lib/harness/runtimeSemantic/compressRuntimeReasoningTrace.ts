/**
 * H17 — reasoning trace **compression**(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { CompressedRuntimeReasoningTrace } from "./runtimeSemanticTypes";
import { parseSemanticKindFromStep, semanticGroupLabelKo } from "./runtimeSemanticKindUtils";

export function compressRuntimeReasoningTrace(
  reasoningReports: RuntimeReasoningPlanningReports
): CompressedRuntimeReasoningTrace {
  const { unifiedReasoningChain, normalizedReasoningTrace } = reasoningReports;

  const raw: string[] = [
    ...unifiedReasoningChain.stableOrdering,
    ...normalizedReasoningTrace.normalizedDependencyTraces,
    ...normalizedReasoningTrace.normalizedPriorityTraces,
    ...unifiedReasoningChain.criticalTransitions,
  ];

  const seen = new Set<string>();
  const compressedLines: string[] = [];
  for (const item of raw) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const kind = parseSemanticKindFromStep(item.includes("(") ? item : `(${item})`);
    const prefix = semanticGroupLabelKo(kind);
    const short = item.length > 72 ? `${item.slice(0, 69)}…` : item;
    compressedLines.push(`[${prefix}] ${short}`);
    if (compressedLines.length >= 8) break;
  }

  const originalItemCount = raw.length;
  const compressedItemCount = compressedLines.length;
  const compressionRatioLabel =
    originalItemCount > 0
      ? `${Math.round((1 - compressedItemCount / originalItemCount) * 100)}% reduced`
      : "—";

  const recommendations: string[] = [
    "Compressed trace는 observability용 planning 메타입니다. actual orchestration 없음.",
    originalItemCount > compressedItemCount + 2
      ? "mobile·compact UI에서는 compressed lines만 표시하는 것을 권장합니다."
      : "reasoning trace 밀도가 관측 범위에서 안정적입니다.",
  ];

  return {
    mode: "compressed_runtime_reasoning_trace",
    actualRuntimeOrchestrationEnabled: false,
    compressedLines,
    originalItemCount,
    compressedItemCount,
    compressionRatioLabel,
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeCompressedRuntimeReasoningTraceForDiagnostic(
  trace: CompressedRuntimeReasoningTrace
): Readonly<Record<string, unknown>> {
  return {
    mode: trace.mode,
    actualRuntimeOrchestrationEnabled: trace.actualRuntimeOrchestrationEnabled,
    compressedLines: [...trace.compressedLines],
    originalItemCount: trace.originalItemCount,
    compressedItemCount: trace.compressedItemCount,
    compressionRatioLabel: trace.compressionRatioLabel,
    recommendations: [...trace.recommendations],
  };
}
