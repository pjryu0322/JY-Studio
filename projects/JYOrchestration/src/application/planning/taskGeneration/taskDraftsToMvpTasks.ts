/**
 * Map planning {@link TaskDraft} rows to in-memory MVP {@link Task} for prompt + execution.
 */

import type { Task } from "../../../mvp/task/taskService";
import type { TaskDraft } from "./taskGenerationContracts";

export function taskDraftsToMvpTasks(drafts: readonly TaskDraft[]): Task[] {
  return drafts.map((d) => ({
    id: d.id,
    title: d.name,
    description: `MOCKUP: ${d.name} (screen ${d.screenId})`,
    type: "FUNCTIONAL",
    status: "CONFIRMED",
    finalOrder: d.order,
    projectId: d.projectId,
    screenId: d.screenId,
    taskPurpose: d.taskPurpose,
  }));
}
