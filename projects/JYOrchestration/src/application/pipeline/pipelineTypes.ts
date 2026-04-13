/**
 * Unified planning pipeline — shared types (no HTTP / no execution).
 */

import type { PrepareRequirementRefinementDecisionResult } from "../planning/requirementInput/prepareRequirementRefinementDecision";

/** Raw user idea, or a pre-built refinement bundle to continue from the feature gate. */
export type PlanningPipelineInput =
  | { projectId: string; inputText: string }
  | { projectId: string; refinement: PrepareRequirementRefinementDecisionResult };

export type PipelineStatus = "READY" | "NEEDS_CONFIRMATION" | "BLOCKED";
