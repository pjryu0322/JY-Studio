/**
 * Application bridge: standardized {@link ScreenGenerationResult} → deterministic tasks.
 */

import { buildTaskGenerationResult } from "./buildTaskGenerationResult";
import type { GenerateStandardTasksRequest, StandardTaskGenerationOutput } from "./taskGenerationContracts";

export function generateStandardTasks(request: GenerateStandardTasksRequest): StandardTaskGenerationOutput {
  return buildTaskGenerationResult(request.screenResult);
}
