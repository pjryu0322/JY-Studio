/**
 * Deterministic deep-ish clones for planning handoff artifacts (internal helpers).
 */

import type { FeatureGenerationResult } from "../planning/featureGeneration/featureGenerationContracts";
import type { IaGenerationResult } from "../planning/iaGeneration/iaGenerationContracts";
import type { ScreenGenerationResult } from "../planning/screenGeneration/screenGenerationContracts";
import type { TaskGenerationResult } from "../planning/taskGeneration/taskGenerationContracts";

export function planningSortedStrings(xs: readonly string[]): string[] {
  return [...xs].sort((a, b) => a.localeCompare(b));
}

export function cloneFeatureGenerationResultForHandoff(r: FeatureGenerationResult): FeatureGenerationResult {
  const features = [...r.features]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({
      ...f,
      requirementIds: planningSortedStrings(f.requirementIds),
    }));
  const traces = [...r.traces].sort((a, b) => {
    const c = a.featureId.localeCompare(b.featureId);
    if (c !== 0) return c;
    return planningSortedStrings(a.requirementIds)
      .join("\0")
      .localeCompare(planningSortedStrings(b.requirementIds).join("\0"));
  });
  return { projectId: r.projectId, features, traces };
}

export function cloneIaGenerationResultForHandoff(r: IaGenerationResult): IaGenerationResult {
  const menuNodes = [...r.menuNodes].sort((a, b) => a.id.localeCompare(b.id)).map((n) => ({ ...n }));
  const traces = [...r.traces].sort((a, b) => a.menuId.localeCompare(b.menuId));
  return { projectId: r.projectId, menuNodes, traces };
}

export function cloneScreenGenerationResultForHandoff(r: ScreenGenerationResult): ScreenGenerationResult {
  const screens = [...r.screens].sort((a, b) => a.id.localeCompare(b.id)).map((s) => ({ ...s }));
  const traces = [...r.traces].sort((a, b) => a.screenId.localeCompare(b.screenId));
  return { projectId: r.projectId, screens, traces };
}

export function cloneTaskGenerationResultForHandoff(r: TaskGenerationResult): TaskGenerationResult {
  /** Match planning screen rank (`order`, then `id`) — not lexicographic task id alone. */
  const tasks = [...r.tasks]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((t) => ({ ...t }));
  const traces = [...r.traces].sort((a, b) => a.taskId.localeCompare(b.taskId));
  return { projectId: r.projectId, tasks, traces };
}
