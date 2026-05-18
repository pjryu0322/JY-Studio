/**
 * Application bridge: standardized {@link FeatureGenerationResult} → deterministic IA.
 */

import { buildIaGenerationResult } from "./buildIaGenerationResult";
import type { GenerateStandardIaRequest, StandardIaGenerationOutput } from "./iaGenerationContracts";

export function generateStandardIa(request: GenerateStandardIaRequest): StandardIaGenerationOutput {
  return buildIaGenerationResult(request.featureResult);
}
