/**
 * Application bridge: only accepts a READY feature-generation entry result.
 */

import type { FeatureGenerationEntryResult } from "../featureEntry/featureEntryContracts";
import type { StandardFeaturesGenerationOutput } from "./featureGenerationContracts";
import { buildFeatureGenerationResult } from "./buildFeatureGenerationResult";

export type GenerateStandardFeaturesRequest = {
  entry: FeatureGenerationEntryResult;
};

/**
 * When the entry gate is not READY, returns {@link StandardFeaturesGenerationState.INVALID_READY_BUNDLE}.
 */
export function generateStandardFeatures(request: GenerateStandardFeaturesRequest): StandardFeaturesGenerationOutput {
  const { entry } = request;
  if (!entry.ok || entry.status !== "READY") {
    return { state: "INVALID_READY_BUNDLE", result: null };
  }
  const built = buildFeatureGenerationResult(entry.input);
  return { state: built.state, result: built.result };
}
