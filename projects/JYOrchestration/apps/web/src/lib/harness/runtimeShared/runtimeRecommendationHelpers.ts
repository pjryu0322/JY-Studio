/**
 * H35.5~H40 — planning layer recommendations 병합(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";

export function mergeRuntimeLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}
