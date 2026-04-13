/**
 * Downstream-safe bundle for Feature generation (entry layer does not call generators).
 */

import type { FeatureGenerationInputBundle } from "./featureEntryContracts";
import type { RefinedRequirement } from "../requirementInput/refinement/refinementContracts";

/**
 * @returns `null` when there are no refined rows (caller should treat as blocked entry).
 */
export function prepareFeatureGenerationInput(
  refinedRequirements: readonly RefinedRequirement[]
): FeatureGenerationInputBundle | null {
  if (refinedRequirements.length === 0) {
    return null;
  }
  const projectId = refinedRequirements[0]!.projectId;
  if (refinedRequirements.some((r) => r.projectId !== projectId)) {
    return null;
  }
  return {
    projectId,
    refinedRequirements: refinedRequirements.map((r) => ({ ...r })),
  };
}
