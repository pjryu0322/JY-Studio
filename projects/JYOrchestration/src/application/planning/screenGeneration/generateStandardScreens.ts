/**
 * Application bridge: standardized {@link IaGenerationResult} → deterministic screens.
 */

import { buildScreenGenerationResult } from "./buildScreenGenerationResult";
import type { GenerateStandardScreensRequest, StandardScreenGenerationOutput } from "./screenGenerationContracts";

export function generateStandardScreens(request: GenerateStandardScreensRequest): StandardScreenGenerationOutput {
  return buildScreenGenerationResult(request.iaResult);
}
