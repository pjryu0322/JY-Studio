/**
 * Wraps IA synthesis with internal empty / invalid semantics (no HTTP).
 */

import type { FeatureGenerationResult } from "../featureGeneration/featureGenerationContracts";
import type { IaGenerationResult, StandardIaGenerationOutput } from "./iaGenerationContracts";
import { generateIaFromFeatures } from "./generateIaFromFeatures";

export function buildIaGenerationResult(featureResult: FeatureGenerationResult): StandardIaGenerationOutput {
  const { projectId, features } = featureResult;
  if (features.length === 0) {
    return {
      state: "EMPTY_FEATURES",
      result: { projectId, menuNodes: [], traces: [] },
    };
  }
  const projectIds = new Set(features.map((f) => f.projectId));
  if (projectIds.size !== 1 || !projectIds.has(projectId)) {
    return { state: "INVALID_FEATURE_INPUT", result: null };
  }
  const result: IaGenerationResult = generateIaFromFeatures(features);
  const out: StandardIaGenerationOutput = { state: "GENERATED", result };
  return out;
}
