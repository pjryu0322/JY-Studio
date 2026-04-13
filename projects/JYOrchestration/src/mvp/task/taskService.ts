/**
 * MVP — task store + executable task list for executionService (in-memory only).
 */

export type Task = {
  id: string;
  title: string;
  description: string;
  type: "FUNCTIONAL" | "NON_FUNCTIONAL";
  status: "CONFIRMED" | "DRAFT";
  finalOrder: number;
};

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
}

export interface TaskConfirmInput {
  taskId: string;
  actorId: string;
}

export interface TaskConfirmResult {
  taskId: string;
  confirmed: boolean;
}

const registry = new Map<string, Task[]>();
const byId = new Map<string, Task>();

/** Replace all tasks for a project (task ids should be unique). */
export function mvpSeedProjectTasks(projectId: string, tasks: Task[]): void {
  const prev = registry.get(projectId) ?? [];
  for (const t of prev) {
    byId.delete(t.id);
  }
  const next = tasks.slice();
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

function defaultMockTasks(projectId: string): Task[] {
  return [
    {
      id: `mvp-mock-1-${projectId}`,
      title: "MVP mock functional task",
      description: "Auto-seeded mock task when no tasks are registered for this project.",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 0,
    },
  ];
}

/**
 * Executable tasks for the MVP pipeline: FUNCTIONAL + CONFIRMED, finalOrder ASC.
 * If nothing was seeded for the project, returns a small mock list so the engine stays runnable.
 */
export async function getExecutableTasks(projectId: string): Promise<Task[]> {
  const rows = registry.get(projectId);
  let source: Task[];
  if (rows && rows.length > 0) {
    source = rows;
  } else {
    source = defaultMockTasks(projectId);
    for (const t of source) {
      byId.set(t.id, { ...t });
    }
  }
  return source
    .filter((t) => t.type === "FUNCTIONAL" && t.status === "CONFIRMED")
    .sort((a, b) => a.finalOrder - b.finalOrder)
    .map((t) => ({ ...t }));
}

/** All tasks for a project (no pipeline filter); useful for inspection / demos. */
export async function listAllTasks(projectId: string): Promise<Task[]> {
  const rows = registry.get(projectId);
  if (rows && rows.length > 0) {
    return rows.map((t) => ({ ...t }));
  }
  const mocks = defaultMockTasks(projectId);
  for (const t of mocks) {
    byId.set(t.id, { ...t });
  }
  return mocks.map((t) => ({ ...t }));
}

export async function createTaskDraft(_input: TaskDraftInput): Promise<TaskDraftResult> {
  return { draftId: "mvp-draft", projectId: _input.projectId };
}

export async function classifyTask(_input: TaskClassificationInput): Promise<TaskClassificationResult> {
  return { taskId: _input.taskId, labels: [] };
}

export async function reorderTasks(_input: TaskReorderInput): Promise<TaskReorderResult> {
  return { ok: false };
}

export async function confirmTask(_input: TaskConfirmInput): Promise<TaskConfirmResult> {
  return { taskId: _input.taskId, confirmed: false };
}
