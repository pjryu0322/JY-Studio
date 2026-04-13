import type { TaskProvider } from "../ports/mvpPorts";

/**
 * MVP — task store + executable task list for executionService (in-memory only).
 *
 * Contract for executionService:
 * - `getExecutableTasks(projectId)` returns only FUNCTIONAL + CONFIRMED tasks, sorted by `finalOrder` ASC.
 * - If `mvpSeedProjectTasks(projectId, [])` was used, the project explicitly has zero tasks (no implicit mock).
 * - If the project was never seeded, `getExecutableTasks` still returns one built-in mock task for demos.
 * - No database.
 */

export type Task = {
  id: string;
  title: string;
  description: string;
  type: "FUNCTIONAL" | "NON_FUNCTIONAL";
  status: "CONFIRMED" | "DRAFT";
  finalOrder: number;
  /** Optional; improves prompt “project context” section when set. */
  projectId?: string;
  /**
   * Optional for backward compatibility. New upstream-generated tasks should set `screenId`.
   * Execution pipeline ignores this field today.
   */
  screenId?: string;
  /** Optional for backward compatibility. Used by upstream generation only. */
  taskPurpose?: TaskPurpose;
};

export type TaskPurpose = "MOCKUP" | "BUILD";

export interface TaskDraftInput {
  projectId: string;
  title: string;
  body?: string | null;
}

export interface TaskDraftResult {
  draftId: string;
  projectId: string;
}

export interface TaskClassificationInput {
  taskId: string;
  hints?: string[] | null;
}

export interface TaskClassificationResult {
  taskId: string;
  labels: string[];
}

export interface TaskReorderInput {
  projectId: string;
  orderedTaskIds: string[];
}

export interface TaskReorderResult {
  ok: boolean;
  message?: string;
}

export interface TaskConfirmInput {
  taskId: string;
  actorId: string;
}

export interface TaskConfirmResult {
  taskId: string;
  confirmed: boolean;
  message?: string;
}

const registry = new Map<string, Task[]>();
const byId = new Map<string, Task>();

/** Replace all tasks for a project (task ids should be unique). Use `[]` for explicit “no tasks”. */
export function mvpSeedProjectTasks(projectId: string, tasks: Task[]): void {
  const prev = registry.get(projectId) ?? [];
  for (const t of prev) {
    byId.delete(t.id);
  }
  const next = tasks.map((t) => ({ ...t, projectId: t.projectId ?? projectId }));
  registry.set(projectId, next);
  for (const t of next) {
    byId.set(t.id, t);
  }
}

export function mvpClearTaskStore(): void {
  registry.clear();
  byId.clear();
}

/** Lookup any seeded task by id (for promptService). */
export function mvpGetTaskById(taskId: string): Task | undefined {
  return byId.get(taskId);
}

function findTaskLocation(taskId: string): { projectId: string; index: number } | null {
  for (const [projectId, list] of registry) {
    const index = list.findIndex((t) => t.id === taskId);
    if (index >= 0) {
      return { projectId, index };
    }
  }
  return null;
}

function defaultMockTasks(projectId: string): Task[] {
  return [
    {
      id: `mvp-mock-1-${projectId}`,
      title: "MVP mock functional task",
      description: "Auto-seeded mock task when no tasks are registered for this project.",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 0,
      projectId,
    },
  ];
}

/**
 * Executable tasks for the MVP pipeline.
 * - Includes only `type === "FUNCTIONAL"` and `status === "CONFIRMED"`.
 * - Sorted by `finalOrder` ascending.
 * - If the project key exists in the registry (including `[]`), uses that list only (no implicit mock).
 * - If the project was never registered, returns one built-in mock task.
 */
export async function getExecutableTasks(projectId: string): Promise<Task[]> {
  if (registry.has(projectId)) {
    const rows = registry.get(projectId)!;
    return rows
      .filter((t) => t.type === "FUNCTIONAL" && t.status === "CONFIRMED")
      .sort((a, b) => a.finalOrder - b.finalOrder)
      .map((t) => ({ ...t }));
  }
  const source = defaultMockTasks(projectId);
  for (const t of source) {
    byId.set(t.id, { ...t });
  }
  return source
    .filter((t) => t.type === "FUNCTIONAL" && t.status === "CONFIRMED")
    .sort((a, b) => a.finalOrder - b.finalOrder)
    .map((t) => ({ ...t }));
}

/** All tasks for a project (no pipeline filter). */
export async function listAllTasks(projectId: string): Promise<Task[]> {
  if (registry.has(projectId)) {
    return (registry.get(projectId) ?? []).map((t) => ({ ...t }));
  }
  const mocks = defaultMockTasks(projectId);
  for (const t of mocks) {
    byId.set(t.id, { ...t });
  }
  return mocks.map((t) => ({ ...t }));
}

/**
 * Reorders tasks in a project: `orderedTaskIds` must be a permutation of all task ids in that project.
 * Updates `finalOrder` to 0..n-1 according to the list order.
 */
export async function reorderTasks(input: TaskReorderInput): Promise<TaskReorderResult> {
  const list = registry.get(input.projectId);
  if (!list?.length) {
    return { ok: false, message: "no tasks for project" };
  }
  if (input.orderedTaskIds.length !== list.length) {
    return { ok: false, message: "orderedTaskIds must include every task id exactly once" };
  }
  if (new Set(input.orderedTaskIds).size !== input.orderedTaskIds.length) {
    return { ok: false, message: "orderedTaskIds must not contain duplicates" };
  }
  const idSet = new Set(list.map((t) => t.id));
  for (const id of input.orderedTaskIds) {
    if (!idSet.has(id)) {
      return { ok: false, message: `unknown task id: ${id}` };
    }
  }
  const orderMap = new Map(input.orderedTaskIds.map((id, i) => [id, i]));
  const next = list.map((t) => ({
    ...t,
    finalOrder: orderMap.get(t.id)!,
    projectId: t.projectId ?? input.projectId,
  }));
  registry.set(input.projectId, next);
  for (const t of next) {
    byId.set(t.id, t);
  }
  return { ok: true };
}

/**
 * Sets a task's status to CONFIRMED when it exists in the in-memory registry (any project).
 */
export async function confirmTask(input: TaskConfirmInput): Promise<TaskConfirmResult> {
  const loc = findTaskLocation(input.taskId);
  if (!loc) {
    return { taskId: input.taskId, confirmed: false, message: "task not found" };
  }
  const list = registry.get(loc.projectId)!;
  const row = list[loc.index]!;
  if (row.status === "CONFIRMED") {
    return { taskId: input.taskId, confirmed: true, message: "already confirmed" };
  }
  const nextRow = { ...row, status: "CONFIRMED" as const };
  const nextList = list.map((t, i) => (i === loc.index ? nextRow : t));
  registry.set(loc.projectId, nextList);
  byId.set(nextRow.id, nextRow);
  return { taskId: input.taskId, confirmed: true };
}

export async function createTaskDraft(_input: TaskDraftInput): Promise<TaskDraftResult> {
  return { draftId: "mvp-draft", projectId: _input.projectId };
}

export async function classifyTask(_input: TaskClassificationInput): Promise<TaskClassificationResult> {
  return { taskId: _input.taskId, labels: [] };
}

/** Default in-memory `TaskProvider` port (same behavior as calling `getExecutableTasks` directly). */
export const mvpDefaultTaskProvider: TaskProvider = {
  getExecutableTasks,
};
