/**
 * Stable task ordering from screen `order` (ScreenFlow can be wired later without changing call sites).
 */

import type { TaskDraft } from "./taskGenerationContracts";

export type ScreenOrderInput = {
  id: string;
  order: number;
};

/**
 * Re-ranks tasks by the sorted screen list (`order`, then `id`).
 * ScreenFlow is not part of {@link ScreenGenerationResult} yet; this follows screen order only.
 */
export function assignTaskOrder(tasks: readonly TaskDraft[], screens: readonly ScreenOrderInput[]): TaskDraft[] {
  const sortedScreens = [...screens].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const rank = new Map(sortedScreens.map((s, i) => [s.id, i]));
  return tasks.map((t) => ({
    ...t,
    order: rank.get(t.screenId) ?? t.order,
  }));
}
