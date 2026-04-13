/**
 * Refined requirements → standardized {@link FeatureDraft} rows + traces.
 */

import type { FeatureGenerationInputBundle } from "../featureEntry/featureEntryContracts";
import type { FeatureDraft, FeatureGenerationResult } from "./featureGenerationContracts";
import { groupRequirementsIntoFeatures, resolveDefaultFeatureNameForGroup } from "./groupRequirementsIntoFeatures";
import { normalizeFeatureName } from "./normalizeFeatureName";

export function generateFeaturesFromRefinedRequirements(
  inputBundle: FeatureGenerationInputBundle
): FeatureGenerationResult {
  const { projectId, refinedRequirements } = inputBundle;
  const groups = groupRequirementsIntoFeatures(refinedRequirements);
  const features: FeatureDraft[] = groups.map((g, order) => {
    const name = normalizeFeatureName(resolveDefaultFeatureNameForGroup(g));
    return {
      id: `feat-refined-${projectId}-${order}`,
      projectId,
      name,
      requirementIds: [...g.requirementIds],
      order,
      source: "REQUIREMENT_REFINEMENT",
    };
  });
  const traces = features.map((f) => ({
    featureId: f.id,
    requirementIds: [...f.requirementIds],
  }));
  return { projectId, features, traces };
}
