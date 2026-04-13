/**
 * Single read-model summarizing a planning pipeline run (no HTTP / no execution).
 */

import type { PipelineContext, PipelineStageOutputCounts } from "./pipelineContext";
import type { PipelineStatus } from "./pipelineTypes";
import type { PipelineStopReason } from "./pipelineStopReason";
import { legacyEarlyStopReasonString } from "./pipelineStopReason";
import { buildPlanningStageSnapshots, type PlanningStageSnapshots } from "./planningStageSnapshots";

export type PlanningPipelineOutputsPresence = {
  normalizedText: boolean;
  requirementDrafts: boolean;
  requirementGaps: boolean;
  gapViewModel: boolean;
  refinementArtifacts: boolean;
  featureEntry: boolean;
  features: boolean;
  iaResult: boolean;
  screens: boolean;
  tasks: boolean;
};

export type PlanningPipelineResultViewModel = {
  projectId: string;
  /** Same as context input mode: raw string length / refinement uses normalized text as inputText. */
  inputTextLength: number;
  status: PipelineStatus | undefined;
  executedSteps: readonly string[];
  /** Typed terminal reason when stopped or failed; null when not applicable (e.g. READY without stop). */
  stopReason: PipelineStopReason | null;
  /**
   * Legacy duplicate of typed stop (see {@link legacyEarlyStopReasonString}); kept for backward compatibility
   * with callers that read `PipelineContext.earlyStopReason`.
   */
  legacyEarlyStopReason: string | undefined;
  stageOutputCounts: PipelineStageOutputCounts;
  snapshots: PlanningStageSnapshots;
  outputsPresent: PlanningPipelineOutputsPresence;
  errors: readonly string[];
};

function buildOutputsPresence(ctx: PipelineContext): PlanningPipelineOutputsPresence {
  return {
    normalizedText: ctx.normalizedText != null && String(ctx.normalizedText).length > 0,
    requirementDrafts: (ctx.requirementDrafts?.length ?? 0) > 0,
    requirementGaps: (ctx.requirementGaps?.length ?? 0) > 0,
    gapViewModel: ctx.gapViewModel != null,
    refinementArtifacts: ctx.refinementDecision != null && ctx.readinessResult != null,
    featureEntry: ctx.featureGenerationEntry != null,
    features: ctx.features != null,
    iaResult: ctx.iaResult != null,
    screens: ctx.screens != null,
    tasks: ctx.tasks != null,
  };
}

export function buildPlanningPipelineResultViewModel(ctx: PipelineContext): PlanningPipelineResultViewModel {
  const stop = ctx.pipelineStop ?? null;
  const legacy = stop != null ? legacyEarlyStopReasonString(stop) : ctx.earlyStopReason;

  return {
    projectId: ctx.projectId,
    inputTextLength: ctx.inputText.length,
    status: ctx.status,
    executedSteps: [...(ctx.executedSteps ?? [])],
    stopReason: stop,
    legacyEarlyStopReason: legacy,
    stageOutputCounts: { ...(ctx.stageOutputCounts ?? {}) },
    snapshots: buildPlanningStageSnapshots(ctx),
    outputsPresent: buildOutputsPresence(ctx),
    errors: [...(ctx.errors ?? [])],
  };
}

export type PlanningPipelineApplicationResult = {
  context: PipelineContext;
  viewModel: PlanningPipelineResultViewModel;
};
