/**
 * Lightweight deterministic snapshots derived from {@link import("./pipelineContext").PipelineContext}
 * for diagnostics and future UI read-models.
 */

import type { PipelineContext } from "./pipelineContext";

export type PlanningStageSnapshots = {
  requirementDraftCount: number;
  /** Draft descriptions ordered by stable draft id (trimmed strings only). */
  requirementDraftDescriptionsOrdered?: readonly string[];
  gapCount: number;
  /** Distinct gap codes, lexicographically sorted. */
  gapCodesOrdered?: readonly string[];
  gapUxSectionCount?: number;
  refinedRequirementCount?: number;
  /** Feature display names, lexicographically sorted. */
  featureNamesOrdered?: readonly string[];
  /** Menu nodes with `parentId === null` (including synthetic root if present). */
  iaRootMenuCount?: number;
  /** Screen route paths, lexicographically sorted. */
  screenRoutesOrdered?: readonly string[];
  /** Planning task draft ids, lexicographically sorted. */
  taskIdsOrdered?: readonly string[];
};

function sortedUniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * Builds a deterministic snapshot from the latest values on the context (partial runs supported).
 */
export function buildPlanningStageSnapshots(ctx: PipelineContext): PlanningStageSnapshots {
  const drafts = ctx.requirementDrafts ?? [];
  const gaps = ctx.requirementGaps ?? [];
  const draftSorted = [...drafts].sort((a, b) => a.id.localeCompare(b.id));

  const out: PlanningStageSnapshots = {
    requirementDraftCount: drafts.length,
    gapCount: gaps.length,
  };

  if (drafts.length > 0) {
    out.requirementDraftDescriptionsOrdered = draftSorted.map((d) => d.description.trim());
  }

  if (gaps.length > 0) {
    out.gapCodesOrdered = sortedUniqueStrings(gaps.map((g) => g.code));
  }

  if (ctx.gapViewModel != null) {
    out.gapUxSectionCount = ctx.gapViewModel.sections.length;
  }

  if (ctx.refinedRequirements != null) {
    out.refinedRequirementCount = ctx.refinedRequirements.length;
  }

  if (ctx.features != null && ctx.features.features.length > 0) {
    out.featureNamesOrdered = sortedUniqueStrings(ctx.features.features.map((f) => f.name.trim()));
  }

  if (ctx.iaResult != null) {
    out.iaRootMenuCount = ctx.iaResult.menuNodes.filter((n) => n.parentId == null).length;
  }

  if (ctx.screens != null && ctx.screens.screens.length > 0) {
    out.screenRoutesOrdered = sortedUniqueStrings(ctx.screens.screens.map((s) => s.routePath.trim()));
  }

  if (ctx.tasks != null && ctx.tasks.tasks.length > 0) {
    out.taskIdsOrdered = [...ctx.tasks.tasks].sort((a, b) => a.id.localeCompare(b.id)).map((t) => t.id);
  }

  return out;
}
