/**
 * Mutable pipeline context passed through each step.
 */

import type { RequirementDraft, RequirementGap } from "../planning/requirementInput/requirementInputContracts";
import type { RequirementGapViewModel } from "../planning/requirementInput/gapUx/gapUxContracts";
import type {
  RefinedRequirement,
  RequirementReadinessResult,
  RequirementRefinementDecision,
} from "../planning/requirementInput/refinement/refinementContracts";
import type { FeatureGenerationDecision, FeatureGenerationEntryResult } from "../planning/featureEntry/featureEntryContracts";
import type { FeatureGenerationResult } from "../planning/featureGeneration/featureGenerationContracts";
import type { IaGenerationResult } from "../planning/iaGeneration/iaGenerationContracts";
import type { ScreenGenerationResult } from "../planning/screenGeneration/screenGenerationContracts";
import type { TaskGenerationResult } from "../planning/taskGeneration/taskGenerationContracts";
import { detectRequirementGaps } from "../planning/requirementInput/detectRequirementGaps";
import type { PlanningPipelineInput, PipelineStatus } from "./pipelineTypes";

/** Artifact counts after each planning stage (best-effort; only keys present when a step ran). */
export type PipelineStageOutputCounts = Partial<{
  requirementDrafts: number;
  requirementGaps: number;
  gapUxSections: number;
  refinedRequirements: number;
  features: number;
  iaMenuNodes: number;
  screens: number;
  tasks: number;
}>;

export type PipelineContext = {
  projectId: string;
  inputText: string;

  normalizedText?: string;
  requirementDrafts?: RequirementDraft[];
  requirementGaps?: RequirementGap[];
  gapViewModel?: RequirementGapViewModel;

  refinementDecision?: RequirementRefinementDecision;
  refinedRequirements?: RefinedRequirement[];
  readinessResult?: RequirementReadinessResult;

  /** Result of {@link buildFeatureGenerationDecision} (entry gate). */
  featureEntryDecision?: FeatureGenerationDecision;
  /** Discriminated entry result used by feature generation when READY. */
  featureGenerationEntry?: FeatureGenerationEntryResult;

  features?: FeatureGenerationResult;
  iaResult?: IaGenerationResult;
  screens?: ScreenGenerationResult;
  tasks?: TaskGenerationResult;

  /** Terminal outcome once the runner stops or finishes. */
  status?: PipelineStatus;
  errors?: string[];
  traceLogs?: string[];

  /** Step function names executed in order (includes steps that ran before an early terminal). */
  executedSteps?: string[];
  /** Set when {@link status} is terminal (`BLOCKED` / `NEEDS_CONFIRMATION`) from the gate or a generation failure. */
  earlyStopReason?: string;
  /** Latest known counts per artifact type (merged across steps). */
  stageOutputCounts?: PipelineStageOutputCounts;
};

export function createPipelineContext(input: PlanningPipelineInput): PipelineContext {
  if ("refinement" in input) {
    const r = input.refinement;
    const requirementGaps = detectRequirementGaps(r.normalizedText, r.drafts);
    return {
      projectId: input.projectId,
      inputText: r.normalizedText,
      normalizedText: r.normalizedText,
      requirementDrafts: [...r.drafts],
      requirementGaps,
      gapViewModel: r.gapViewModel,
      refinementDecision: r.refinementDecision,
      refinedRequirements: [...r.refinedRequirements],
      readinessResult: r.readinessResult,
      traceLogs: [],
      errors: [],
      executedSteps: [],
      stageOutputCounts: {},
    };
  }
  return {
    projectId: input.projectId,
    inputText: input.inputText,
    traceLogs: [],
    errors: [],
    executedSteps: [],
    stageOutputCounts: {},
  };
}

export function appendTrace(ctx: PipelineContext, step: string, message: string): void {
  if (!ctx.traceLogs) ctx.traceLogs = [];
  ctx.traceLogs.push(`[${step}] ${message}`);
}
