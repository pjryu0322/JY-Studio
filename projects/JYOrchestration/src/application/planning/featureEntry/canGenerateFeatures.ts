/**
 * Core gating: refinement readiness + minimal input sanity (no Feature synthesis).
 */

import type { RequirementReadinessResult, RequirementRefinementDecision } from "../requirementInput/refinement/refinementContracts";
import type { FeatureGenerationEntryStatus } from "./featureEntryContracts";

/**
 * - Empty normalized text → BLOCKED
 * - Any BLOCKING gap decision → BLOCKED
 * - Any USER_CONFIRM gap decision → NEEDS_CONFIRMATION
 * - Otherwise (AUTO-only or no gaps) → READY
 */
export function canGenerateFeatures(
  readinessResult: RequirementReadinessResult,
  refinementDecision: RequirementRefinementDecision
): FeatureGenerationEntryStatus {
  if (!refinementDecision.normalizedText.trim()) {
    return "BLOCKED";
  }
  if (readinessResult.blockingIssues.length > 0) {
    return "BLOCKED";
  }
  if (readinessResult.confirmRequired.length > 0) {
    return "NEEDS_CONFIRMATION";
  }
  return "READY";
}
