/**
 * Unified MVP planning orchestration — composes existing planning modules only.
 *
 * Stops before execution / prompts. Early exit on {@link PipelineStatus.BLOCKED} or NEEDS_CONFIRMATION.
 */

import { buildRequirementDrafts } from "../planning/requirementInput/buildRequirementDrafts";
import { buildRequirementGapViewModel } from "../planning/requirementInput/gapUx/buildRequirementGapViewModel";
import { detectRequirementGaps } from "../planning/requirementInput/detectRequirementGaps";
import { normalizeRequirementInput } from "../planning/requirementInput/normalizeRequirementInput";
import { buildRefinementDecision } from "../planning/requirementInput/refinement/buildRefinementDecision";
import { buildRefinedRequirements } from "../planning/requirementInput/refinement/buildRefinedRequirements";
import { evaluateRequirementReadiness } from "../planning/requirementInput/refinement/evaluateRequirementReadiness";
import { buildFeatureGenerationDecision } from "../planning/featureEntry/buildFeatureGenerationDecision";
import { generateStandardFeatures } from "../planning/featureGeneration/generateStandardFeatures";
import { generateStandardIa } from "../planning/iaGeneration/generateStandardIa";
import { generateStandardScreens } from "../planning/screenGeneration/generateStandardScreens";
import { generateStandardTasks } from "../planning/taskGeneration/generateStandardTasks";
import type { PlanningPipelineInput, PipelineStatus } from "./pipelineTypes";
import { appendTrace, createPipelineContext, type PipelineContext } from "./pipelineContext";

function isTerminal(ctx: PipelineContext): boolean {
  return ctx.status === "BLOCKED" || ctx.status === "NEEDS_CONFIRMATION";
}

function shouldRunDownstream(ctx: PipelineContext): boolean {
  return !isTerminal(ctx);
}

export function stepNormalizeInput(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const { text } = normalizeRequirementInput(ctx.inputText);
  appendTrace(ctx, "stepNormalizeInput", `length=${text.length}`);
  return { ...ctx, normalizedText: text };
}

export function stepBuildRequirementDrafts(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const draftResult = buildRequirementDrafts({ projectId: ctx.projectId, inputText: ctx.inputText });
  appendTrace(ctx, "stepBuildRequirementDrafts", `drafts=${draftResult.drafts.length} gaps=${draftResult.gaps.length}`);
  return {
    ...ctx,
    normalizedText: draftResult.normalizedText,
    requirementDrafts: draftResult.drafts,
    requirementGaps: draftResult.gaps,
    stageOutputCounts: {
      ...ctx.stageOutputCounts,
      requirementDrafts: draftResult.drafts.length,
      requirementGaps: draftResult.gaps.length,
    },
  };
}

export function stepDetectGaps(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const gaps = detectRequirementGaps(ctx.normalizedText ?? "", ctx.requirementDrafts ?? []);
  appendTrace(ctx, "stepDetectGaps", `count=${gaps.length}`);
  return {
    ...ctx,
    requirementGaps: gaps,
    stageOutputCounts: { ...ctx.stageOutputCounts, requirementGaps: gaps.length },
  };
}

export function stepBuildGapUX(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const gapViewModel = buildRequirementGapViewModel({
    normalizedText: ctx.normalizedText ?? "",
    drafts: ctx.requirementDrafts ?? [],
    gaps: ctx.requirementGaps ?? [],
  });
  appendTrace(ctx, "stepBuildGapUX", `sections=${gapViewModel.sections.length}`);
  return {
    ...ctx,
    gapViewModel,
    stageOutputCounts: { ...ctx.stageOutputCounts, gapUxSections: gapViewModel.sections.length },
  };
}

export function stepRefinementDecision(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const refinementDecision = buildRefinementDecision({
    normalizedText: ctx.normalizedText ?? "",
    drafts: ctx.requirementDrafts ?? [],
    gaps: ctx.requirementGaps ?? [],
  });
  const refinedRequirements = buildRefinedRequirements({ refinementDecision });
  const readinessResult = evaluateRequirementReadiness(refinementDecision);
  appendTrace(
    ctx,
    "stepRefinementDecision",
    `blocking=${readinessResult.blockingIssues.length} confirm=${readinessResult.confirmRequired.length} ready=${readinessResult.isReady}`
  );
  return {
    ...ctx,
    refinementDecision,
    refinedRequirements,
    readinessResult,
    stageOutputCounts: { ...ctx.stageOutputCounts, refinedRequirements: refinedRequirements.length },
  };
}

export function stepFeatureEntryGate(ctx: PipelineContext): PipelineContext {
  if (isTerminal(ctx)) return ctx;
  const { decision, entry } = buildFeatureGenerationDecision({
    refinementDecision: ctx.refinementDecision!,
    readinessResult: ctx.readinessResult!,
    refinedRequirements: ctx.refinedRequirements ?? [],
  });
  appendTrace(ctx, "stepFeatureEntryGate", `status=${decision.status} ok=${entry.ok}`);
  const next: PipelineContext = {
    ...ctx,
    featureEntryDecision: decision,
    featureGenerationEntry: entry,
  };
  if (!entry.ok) {
    const terminal: PipelineStatus = entry.status === "BLOCKED" ? "BLOCKED" : "NEEDS_CONFIRMATION";
    appendTrace(ctx, "stepFeatureEntryGate", `stop=${terminal}`);
    return { ...next, status: terminal, earlyStopReason: `feature_entry_gate:${entry.status}` };
  }
  return next;
}

export function stepFeatureGeneration(ctx: PipelineContext): PipelineContext {
  if (!shouldRunDownstream(ctx)) return ctx;
  const entry = ctx.featureGenerationEntry!;
  if (!entry.ok || entry.status !== "READY") {
    appendTrace(ctx, "stepFeatureGeneration", "skip: entry not READY");
    return ctx;
  }
  const out = generateStandardFeatures({ entry });
  appendTrace(ctx, "stepFeatureGeneration", `state=${out.state}`);
  if (out.state !== "GENERATED" || out.result == null) {
    const errors = [...(ctx.errors ?? []), `FEATURE_GENERATION:${out.state}`];
    appendTrace(ctx, "stepFeatureGeneration", "treat as BLOCKED");
    return { ...ctx, errors, status: "BLOCKED", earlyStopReason: `feature_generation:${out.state}` };
  }
  return {
    ...ctx,
    features: out.result,
    stageOutputCounts: { ...ctx.stageOutputCounts, features: out.result.features.length },
  };
}

export function stepIaGeneration(ctx: PipelineContext): PipelineContext {
  if (!shouldRunDownstream(ctx) || !ctx.features) return ctx;
  const out = generateStandardIa({ featureResult: ctx.features });
  appendTrace(ctx, "stepIaGeneration", `state=${out.state}`);
  if (out.state !== "GENERATED" || out.result == null) {
    const errors = [...(ctx.errors ?? []), `IA_GENERATION:${out.state}`];
    return { ...ctx, errors, status: "BLOCKED", earlyStopReason: `ia_generation:${out.state}` };
  }
  return {
    ...ctx,
    iaResult: out.result,
    stageOutputCounts: { ...ctx.stageOutputCounts, iaMenuNodes: out.result.menuNodes.length },
  };
}

export function stepScreenGeneration(ctx: PipelineContext): PipelineContext {
  if (!shouldRunDownstream(ctx) || !ctx.iaResult) return ctx;
  const out = generateStandardScreens({ iaResult: ctx.iaResult });
  appendTrace(ctx, "stepScreenGeneration", `state=${out.state}`);
  if (out.state !== "GENERATED" || out.result == null) {
    const errors = [...(ctx.errors ?? []), `SCREEN_GENERATION:${out.state}`];
    return { ...ctx, errors, status: "BLOCKED", earlyStopReason: `screen_generation:${out.state}` };
  }
  return {
    ...ctx,
    screens: out.result,
    stageOutputCounts: { ...ctx.stageOutputCounts, screens: out.result.screens.length },
  };
}

export function stepTaskGeneration(ctx: PipelineContext): PipelineContext {
  if (!shouldRunDownstream(ctx) || !ctx.screens) return ctx;
  const out = generateStandardTasks({ screenResult: ctx.screens });
  appendTrace(ctx, "stepTaskGeneration", `state=${out.state}`);
  if (out.state !== "GENERATED" || out.result == null) {
    const errors = [...(ctx.errors ?? []), `TASK_GENERATION:${out.state}`];
    return { ...ctx, errors, status: "BLOCKED", earlyStopReason: `task_generation:${out.state}` };
  }
  return {
    ...ctx,
    tasks: out.result,
    status: "READY",
    stageOutputCounts: { ...ctx.stageOutputCounts, tasks: out.result.tasks.length },
  };
}

const STEPS_FROM_RAW: ReadonlyArray<(ctx: PipelineContext) => PipelineContext> = [
  stepNormalizeInput,
  stepBuildRequirementDrafts,
  stepDetectGaps,
  stepBuildGapUX,
  stepRefinementDecision,
  stepFeatureEntryGate,
  stepFeatureGeneration,
  stepIaGeneration,
  stepScreenGeneration,
  stepTaskGeneration,
];

const STEPS_FROM_REFINEMENT: ReadonlyArray<(ctx: PipelineContext) => PipelineContext> = [
  stepFeatureEntryGate,
  stepFeatureGeneration,
  stepIaGeneration,
  stepScreenGeneration,
  stepTaskGeneration,
];

function finalizeStatus(ctx: PipelineContext): PipelineContext {
  if (ctx.tasks && ctx.tasks.tasks.length > 0 && ctx.status === undefined) {
    return { ...ctx, status: "READY" };
  }
  return ctx;
}

function appendExecutedStep(ctx: PipelineContext, step: (c: PipelineContext) => PipelineContext): PipelineContext {
  return { ...ctx, executedSteps: [...(ctx.executedSteps ?? []), step.name] };
}

/**
 * Runs the planning stack left-to-right. Stops after the feature gate when not READY.
 */
export function runPlanningPipeline(input: PlanningPipelineInput): PipelineContext {
  if ("refinement" in input) {
    let ctx = createPipelineContext(input);
    appendTrace(ctx, "runPlanningPipeline", "mode=from_refinement");
    for (const step of STEPS_FROM_REFINEMENT) {
      ctx = appendExecutedStep(step(ctx), step);
      if (isTerminal(ctx)) break;
    }
    return finalizeStatus(ctx);
  }

  let ctx = createPipelineContext(input);
  appendTrace(ctx, "runPlanningPipeline", "mode=raw_input");
  for (const step of STEPS_FROM_RAW) {
    ctx = appendExecutedStep(step(ctx), step);
    if (isTerminal(ctx)) break;
  }
  return finalizeStatus(ctx);
}
