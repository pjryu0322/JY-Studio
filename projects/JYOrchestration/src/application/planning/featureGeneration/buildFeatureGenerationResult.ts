/**
 * Wraps raw generation with internal empty-input semantics (no HTTP).
 */

import type { FeatureGenerationInputBundle } from "../featureEntry/featureEntryContracts";
import type { FeatureGenerationResult, StandardFeaturesGenerationState } from "./featureGenerationContracts";
import { generateFeaturesFromRefinedRequirements } from "./generateFeaturesFromRefinedRequirements";

export type BuiltFeatureGenerationResult = {
  state: Extract<StandardFeaturesGenerationState, "GENERATED" | "EMPTY_INPUT">;
  result: FeatureGenerationResult;
};

export function buildFeatureGenerationResult(bundle: FeatureGenerationInputBundle): BuiltFeatureGenerationResult {
  if (bundle.refinedRequirements.length === 0) {
    return {
      state: "EMPTY_INPUT",
      result: { projectId: bundle.projectId, features: [], traces: [] },
    };
  }
  return {
    state: "GENERATED",
    result: generateFeaturesFromRefinedRequirements(bundle),
  };
}
