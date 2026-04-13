/**
 * One MOCKUP task per screen (planning boundary; distinct from domain `generateTasksFromScreens`).
 */

import { assignTaskOrder, type ScreenOrderInput } from "./assignTaskOrder";
import type { TaskDraft, TaskGenerationResult, TaskTrace } from "./taskGenerationContracts";
import { normalizeTaskName } from "./normalizeTaskName";

export type ScreenInputForTasks = ScreenOrderInput & {
  projectId: string;
  name: string;
};

/**
 * Preconditions: validated non-empty screen list — use {@link buildTaskGenerationResult}.
 */
export function generateTasksFromScreens(screens: readonly ScreenInputForTasks[]): TaskGenerationResult {
  const projectId = screens[0]!.projectId;
  const sortedScreens = [...screens].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const drafts: TaskDraft[] = sortedScreens.map((s, i) => ({
    id: `task-${s.id}`,
    projectId: s.projectId,
    name: normalizeTaskName(s.name),
    screenId: s.id,
    order: i,
    taskPurpose: "MOCKUP",
    status: "READY",
  }));

  const tasks = assignTaskOrder(drafts, sortedScreens);
  const traces: TaskTrace[] = tasks.map((t) => ({ taskId: t.id, screenId: t.screenId }));
  return { projectId, tasks, traces };
}
