/**
 * Stable `ok: false` entry result for UI/application handoff (no HTTP mapping).
 */

import type { RequirementGapDecision } from "../requirementInput/refinement/refinementContracts";
import type { FeatureGenerationBlockedReason, FeatureGenerationEntryResult } from "./featureEntryContracts";

export function buildBlockedFeatureGenerationResult(params: {
  status: "NEEDS_CONFIRMATION" | "BLOCKED";
  reasons: FeatureGenerationBlockedReason[];
  pendingGapDecisions: readonly RequirementGapDecision[];
}): Extract<FeatureGenerationEntryResult, { ok: false }> {
  return {
    ok: false,
    status: params.status,
    reasons: [...params.reasons],
    pendingGapDecisions: [...params.pendingGapDecisions],
  };
}
