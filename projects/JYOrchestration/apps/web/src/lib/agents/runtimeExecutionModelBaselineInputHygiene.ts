/**
 * Stage 6-A execution unit kind input hygiene (dedupe/sort/unknown trace; read-only).
 */

import { DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS } from "@/lib/agents/runtimeExecutionModelBaselineConstants";
import type { RuntimeExecutionUnitKind } from "@/lib/agents/runtimeExecutionModelBaselineTypes";

const VALID_EXECUTION_UNIT_KINDS = new Set<string>(DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS);

export function uniqueRuntimeExecutionUnitKinds(
  kinds: readonly RuntimeExecutionUnitKind[],
): readonly RuntimeExecutionUnitKind[] {
  return [...new Set(kinds)].sort((a, b) => a.localeCompare(b));
}

export function findUnknownExecutionUnitKinds(
  kinds: readonly RuntimeExecutionUnitKind[],
): readonly string[] {
  return kinds.filter((k) => !VALID_EXECUTION_UNIT_KINDS.has(k)).sort((a, b) => a.localeCompare(b));
}
