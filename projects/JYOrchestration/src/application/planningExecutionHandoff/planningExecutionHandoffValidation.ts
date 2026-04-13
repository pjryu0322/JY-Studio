/**
 * Eligibility and internal consistency checks for {@link import("./planningExecutionHandoffTypes").PlanningExecutionHandoffBundle}.
 */

import type { PipelineContext } from "../pipeline/pipelineContext";
import type { PlanningExecutionHandoffBundle, PlanningHandoffValidationResult } from "./planningExecutionHandoffTypes";

function pushReason(reasons: string[], msg: string): void {
  reasons.push(msg);
}

/** Validates a built handoff bundle (artifact coherence, READY semantics). */
export function validatePlanningExecutionHandoffBundle(bundle: PlanningExecutionHandoffBundle): PlanningHandoffValidationResult {
  const reasons: string[] = [];

  if (bundle.pipelineStatus !== "READY") {
    pushReason(reasons, "HANDOFF_PIPELINE_NOT_READY");
  }

  const pr = bundle.planningReadiness;
  if (!pr.pipelineStatusReady || !pr.featureEntryReady || !pr.readinessIsReady) {
    pushReason(reasons, "HANDOFF_READINESS_FLAGS_FALSE");
  }
  if (pr.readinessBlockingIssueCount !== 0 || pr.readinessConfirmRequiredCount !== 0) {
    pushReason(reasons, "HANDOFF_READINESS_HAS_BLOCKING_OR_CONFIRM");
  }
  if (pr.refinedRequirementCount !== bundle.refinedRequirementsSummary.length) {
    pushReason(reasons, "HANDOFF_REFINED_COUNT_MISMATCH");
  }

  if (bundle.features.features.length === 0) {
    pushReason(reasons, "HANDOFF_MISSING_FEATURES");
  }
  if (bundle.screens.screens.length === 0) {
    pushReason(reasons, "HANDOFF_MISSING_SCREENS");
  }
  if (bundle.tasks.tasks.length === 0) {
    pushReason(reasons, "HANDOFF_MISSING_TASKS");
  }

  if (bundle.iaMenuSummary.menuNodeCount === 0) {
    pushReason(reasons, "HANDOFF_MISSING_IA_MENUS");
  }
  if (bundle.iaMenuSummary.menuNodesOrderedById.length !== bundle.iaMenuSummary.menuNodeCount) {
    pushReason(reasons, "HANDOFF_IA_MENU_COUNT_INCONSISTENT");
  }

  const rootFromRows = bundle.iaMenuSummary.menuNodesOrderedById.filter((n) => n.parentId == null).length;
  if (rootFromRows !== bundle.iaMenuSummary.rootMenuNodeCount) {
    pushReason(reasons, "HANDOFF_IA_ROOT_COUNT_INCONSISTENT");
  }

  const screenIds = new Set(bundle.screens.screens.map((s) => s.id));
  for (const t of bundle.tasks.tasks) {
    if (t.projectId !== bundle.projectId) {
      pushReason(reasons, `HANDOFF_TASK_PROJECT_MISMATCH:${t.id}`);
    }
    if (!screenIds.has(t.screenId)) {
      pushReason(reasons, `HANDOFF_TASK_SCREEN_UNKNOWN:${t.id}`);
    }
  }

  for (const f of bundle.features.features) {
    if (f.projectId !== bundle.projectId) {
      pushReason(reasons, `HANDOFF_FEATURE_PROJECT_MISMATCH:${f.id}`);
    }
  }
  for (const s of bundle.screens.screens) {
    if (s.projectId !== bundle.projectId) {
      pushReason(reasons, `HANDOFF_SCREEN_PROJECT_MISMATCH:${s.id}`);
    }
  }

  const sc = bundle.traceMetadata.stageOutputCounts;
  if (sc.features != null && sc.features !== bundle.features.features.length) {
    pushReason(reasons, "HANDOFF_TRACE_FEATURE_COUNT_MISMATCH");
  }
  if (sc.screens != null && sc.screens !== bundle.screens.screens.length) {
    pushReason(reasons, "HANDOFF_TRACE_SCREEN_COUNT_MISMATCH");
  }
  if (sc.tasks != null && sc.tasks !== bundle.tasks.tasks.length) {
    pushReason(reasons, "HANDOFF_TRACE_TASK_COUNT_MISMATCH");
  }
  if (sc.iaMenuNodes != null && sc.iaMenuNodes !== bundle.iaMenuSummary.menuNodeCount) {
    pushReason(reasons, "HANDOFF_TRACE_IA_COUNT_MISMATCH");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** Same eligibility rules applied to raw pipeline context (pre-build gate). */
export function validatePlanningExecutionHandoffFromContext(ctx: PipelineContext): PlanningHandoffValidationResult {
  const reasons: string[] = [];

  if (ctx.status !== "READY") {
    pushReason(reasons, "CONTEXT_PIPELINE_NOT_READY");
  }
  if (ctx.pipelineStop != null || ctx.earlyStopReason != null) {
    pushReason(reasons, "CONTEXT_HAS_TERMINAL_STOP");
  }

  const entry = ctx.featureGenerationEntry;
  if (entry == null || !entry.ok || entry.status !== "READY") {
    pushReason(reasons, "CONTEXT_FEATURE_ENTRY_NOT_READY");
  }

  const rr = ctx.readinessResult;
  if (rr == null || !rr.isReady) {
    pushReason(reasons, "CONTEXT_READINESS_NOT_READY");
  }
  if (rr != null && (rr.blockingIssues.length > 0 || rr.confirmRequired.length > 0)) {
    pushReason(reasons, "CONTEXT_BLOCKING_OR_CONFIRM_PENDING");
  }

  if (ctx.features == null || ctx.features.features.length === 0) {
    pushReason(reasons, "CONTEXT_MISSING_FEATURES");
  }
  if (ctx.iaResult == null || ctx.iaResult.menuNodes.length === 0) {
    pushReason(reasons, "CONTEXT_MISSING_IA");
  }
  if (ctx.screens == null || ctx.screens.screens.length === 0) {
    pushReason(reasons, "CONTEXT_MISSING_SCREENS");
  }
  if (ctx.tasks == null || ctx.tasks.tasks.length === 0) {
    pushReason(reasons, "CONTEXT_MISSING_TASKS");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function isPlanningExecutionHandoffBundle(x: unknown): x is PlanningExecutionHandoffBundle {
  if (x == null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.planningReadiness != null &&
    typeof o.planningReadiness === "object" &&
    o.traceMetadata != null &&
    typeof o.traceMetadata === "object" &&
    o.iaMenuSummary != null &&
    typeof o.iaMenuSummary === "object" &&
    Array.isArray(o.refinedRequirementsSummary) &&
    o.pipelineStatus === "READY"
  );
}

/**
 * Validates either a {@link PlanningExecutionHandoffBundle} or a {@link PipelineContext}
 * (same eligibility rules; bundle adds artifact consistency checks).
 */
export function validatePlanningExecutionHandoff(
  input: PlanningExecutionHandoffBundle | PipelineContext
): PlanningHandoffValidationResult {
  if (isPlanningExecutionHandoffBundle(input)) {
    return validatePlanningExecutionHandoffBundle(input);
  }
  return validatePlanningExecutionHandoffFromContext(input);
}
