/**
 * Application-facing entry for the unified planning pipeline (no HTTP / no executionService).
 *
 * Returns a stable read-model ({@link PlanningPipelineResultViewModel}) plus the full
 * {@link import("../pipeline/pipelineContext").PipelineContext} for callers that need artifacts.
 */

import type { PlanningPipelineInput } from "../pipeline/pipelineTypes";
import { runPlanningPipeline } from "../pipeline/mvpPlanningPipeline";
import {
  buildPlanningPipelineResultViewModel,
  type PlanningPipelineApplicationResult,
} from "../pipeline/planningPipelineResultViewModel";

export function mvpRunPlanningPipelineUseCase(input: PlanningPipelineInput): PlanningPipelineApplicationResult {
  const context = runPlanningPipeline(input);
  return { context, viewModel: buildPlanningPipelineResultViewModel(context) };
}
