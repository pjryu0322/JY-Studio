import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { ExcludedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";

export function buildIntegrationSelectionResolvedFields(input: {
  readonly totalCodeTaskCount: number;
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
}): Record<string, unknown> {
  return {
    totalCodeTaskCount: input.totalCodeTaskCount,
    includedCount: input.included.length,
    excludedCount: input.excluded.length,
    includedCodeTaskIds: input.included.map((i) => i.codeTaskId).join(","),
    excludedCodeTaskIds: input.excluded.map((e) => e.codeTaskId).join(","),
  };
}
