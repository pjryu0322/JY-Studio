/**
 * Builds a deterministic {@link import("./planningExecutionHandoffTypes").PlanningExecutionHandoffBundle}
 * from pipeline context (no executionService).
 *
 * **Note:** A {@link import("../pipeline/planningPipelineResultViewModel").PlanningPipelineResultViewModel} alone
 * does not include full artifacts; pass {@link PipelineContext} (e.g. from `mvpRunPlanningPipelineUseCase`) here.
 */

import type { PipelineContext } from "../pipeline/pipelineContext";
import type { FeatureGenerationResult } from "../planning/featureGeneration/featureGenerationContracts";
import type { IaGenerationResult } from "../planning/iaGeneration/iaGenerationContracts";
import type { ScreenGenerationResult } from "../planning/screenGeneration/screenGenerationContracts";
import type { TaskGenerationResult } from "../planning/taskGeneration/taskGenerationContracts";
import { validatePlanningExecutionHandoffFromContext } from "./planningExecutionHandoffValidation";
import type {
  BuildPlanningExecutionHandoffResult,
  IaMenuHandoffSummary,
  PlanningExecutionHandoffBundle,
  PlanningHandoffTraceMetadata,
  PlanningReadinessConfirmation,
  RefinedRequirementHandoffSummary,
} from "./planningExecutionHandoffTypes";

const TRACE_LOG_SAMPLE_MAX = 32;

function sortedStrings(xs: readonly string[]): string[] {
  return [...xs].sort((a, b) => a.localeCompare(b));
}

function cloneFeatureGenerationResult(r: FeatureGenerationResult): FeatureGenerationResult {
  const features = [...r.features]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({
      ...f,
      requirementIds: sortedStrings(f.requirementIds),
    }));
  const traces = [...r.traces].sort((a, b) => {
      const c = a.featureId.localeCompare(b.featureId);
      if (c !== 0) return c;
      return sortedStrings(a.requirementIds).join("\0").localeCompare(sortedStrings(b.requirementIds).join("\0"));
    });
  return { projectId: r.projectId, features, traces };
}

function cloneIaGenerationResult(r: IaGenerationResult): IaGenerationResult {
  const menuNodes = [...r.menuNodes].sort((a, b) => a.id.localeCompare(b.id)).map((n) => ({ ...n }));
  const traces = [...r.traces].sort((a, b) => a.menuId.localeCompare(b.menuId));
  return { projectId: r.projectId, menuNodes, traces };
}

function cloneScreenGenerationResult(r: ScreenGenerationResult): ScreenGenerationResult {
  const screens = [...r.screens].sort((a, b) => a.id.localeCompare(b.id)).map((s) => ({ ...s }));
  const traces = [...r.traces].sort((a, b) => a.screenId.localeCompare(b.screenId));
  return { projectId: r.projectId, screens, traces };
}

function cloneTaskGenerationResult(r: TaskGenerationResult): TaskGenerationResult {
  const tasks = [...r.tasks].sort((a, b) => a.id.localeCompare(b.id)).map((t) => ({ ...t }));
  const traces = [...r.traces].sort((a, b) => a.taskId.localeCompare(b.taskId));
  return { projectId: r.projectId, tasks, traces };
}

function buildIaMenuSummary(ia: IaGenerationResult): IaMenuHandoffSummary {
  const sortedNodes = [...ia.menuNodes].sort((a, b) => a.id.localeCompare(b.id));
  const menuNodesOrderedById = sortedNodes.map((n) => ({
    id: n.id,
    projectId: n.projectId,
    name: n.name,
    parentId: n.parentId,
    order: n.order,
    sourceFeatureIdsOrdered: sortedStrings(n.sourceFeatureIds),
  }));
  const rootMenuNodeCount = menuNodesOrderedById.filter((n) => n.parentId == null).length;
  return {
    projectId: ia.projectId,
    menuNodeCount: ia.menuNodes.length,
    rootMenuNodeCount,
    menuNodesOrderedById,
  };
}

function buildRefinedSummaries(ctx: PipelineContext): readonly RefinedRequirementHandoffSummary[] {
  const list = ctx.refinedRequirements ?? [];
  return [...list]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      projectId: r.projectId,
      description: r.description,
      status: r.status,
      source: r.source,
    }));
}

function buildTraceMetadata(ctx: PipelineContext): PlanningHandoffTraceMetadata {
  const logs = ctx.traceLogs ?? [];
  return {
    executedSteps: [...(ctx.executedSteps ?? [])],
    stageOutputCounts: { ...(ctx.stageOutputCounts ?? {}) },
    traceLogSample: logs.slice(0, TRACE_LOG_SAMPLE_MAX),
  };
}

function buildReadinessConfirmation(refinedCount: number): PlanningReadinessConfirmation {
  return {
    pipelineStatusReady: true,
    featureEntryReady: true,
    readinessIsReady: true,
    readinessBlockingIssueCount: 0,
    readinessConfirmRequiredCount: 0,
    refinedRequirementCount: refinedCount,
  };
}

/**
 * Builds a handoff bundle from pipeline context. Returns `{ ok: false }` unless the pipeline is READY
 * and passes {@link validatePlanningExecutionHandoffFromContext}.
 */
export function buildPlanningExecutionHandoff(ctx: PipelineContext): BuildPlanningExecutionHandoffResult {
  const gate = validatePlanningExecutionHandoffFromContext(ctx);
  if (!gate.ok) {
    return { ok: false, reason: gate.reasons.join(" | ") };
  }

  if (ctx.status !== "READY" || ctx.features == null || ctx.iaResult == null || ctx.screens == null || ctx.tasks == null) {
    return { ok: false, reason: "HANDOFF_BUILD_INTERNAL_INVARIANT" };
  }

  const refinedSummaries = buildRefinedSummaries(ctx);
  const readiness = buildReadinessConfirmation(refinedSummaries.length);

  const bundle: PlanningExecutionHandoffBundle = {
    projectId: ctx.projectId,
    pipelineStatus: "READY",
    planningReadiness: readiness,
    refinedRequirementsSummary: refinedSummaries,
    features: cloneFeatureGenerationResult(ctx.features),
    iaMenuSummary: buildIaMenuSummary(ctx.iaResult),
    screens: cloneScreenGenerationResult(ctx.screens),
    tasks: cloneTaskGenerationResult(ctx.tasks),
    traceMetadata: buildTraceMetadata(ctx),
  };

  return { ok: true, bundle };
}
