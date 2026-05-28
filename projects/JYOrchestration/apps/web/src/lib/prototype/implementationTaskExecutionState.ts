import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type {
  ImplementationTaskListV1,
  ImplementationTaskOwnerRole,
} from "@/lib/requirements/implementationTaskList";

export const IMPLEMENTATION_TASK_EXECUTION_STATE_VERSION =
  "implementation_task_execution_state_v1" as const;

export type ImplementationTaskExecutionStatus =
  | "ready"
  | "queued"
  | "in_progress"
  | "done"
  | "failed"
  | "skipped";

export type ImplementationTaskExecutionRole = ImplementationTaskOwnerRole;

export type ImplementationTaskExecutionItemV1 = Readonly<{
  readonly taskId: string;
  readonly ownerRole: ImplementationTaskExecutionRole;
  readonly status: ImplementationTaskExecutionStatus;
  readonly sourceTaskTitle?: string;
  readonly cursorWorkItemId?: string;
  readonly codeAgentWipExecutionId?: string;
  readonly prototypeRunId?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly resultSummary?: string;
  readonly errorMessage?: string;
}>;

export type ImplementationTaskExecutionSummary = Readonly<{
  readonly total: number;
  readonly ready: number;
  readonly queued: number;
  readonly inProgress: number;
  readonly done: number;
  readonly failed: number;
  readonly skipped: number;
}>;

export type ImplementationTaskExecutionStateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_TASK_EXECUTION_STATE_VERSION;
  readonly projectId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: "implementation_task_list";
  readonly items: readonly ImplementationTaskExecutionItemV1[];
  readonly summary: ImplementationTaskExecutionSummary;
}>;

const TERMINAL_STATUSES = new Set<ImplementationTaskExecutionStatus>(["done", "failed", "skipped"]);

function mapTaskListStatusToExecution(
  status: import("@/lib/requirements/implementationTaskList").ImplementationTaskStatus,
): ImplementationTaskExecutionStatus {
  if (status === "in_progress") return "in_progress";
  if (status === "done") return "done";
  if (status === "blocked") return "skipped";
  return "ready";
}

function emptySummary(): ImplementationTaskExecutionSummary {
  return {
    total: 0,
    ready: 0,
    queued: 0,
    inProgress: 0,
    done: 0,
    failed: 0,
    skipped: 0,
  };
}

export function summarizeImplementationTaskExecutionItems(
  items: readonly ImplementationTaskExecutionItemV1[],
): ImplementationTaskExecutionSummary {
  const summary = emptySummary();
  for (const item of items) {
    summary.total += 1;
    if (item.status === "ready") summary.ready += 1;
    else if (item.status === "queued") summary.queued += 1;
    else if (item.status === "in_progress") summary.inProgress += 1;
    else if (item.status === "done") summary.done += 1;
    else if (item.status === "failed") summary.failed += 1;
    else if (item.status === "skipped") summary.skipped += 1;
  }
  return summary;
}

export function parseImplementationTaskExecutionStateV1(
  raw: unknown,
): ImplementationTaskExecutionStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IMPLEMENTATION_TASK_EXECUTION_STATE_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!projectId || !createdAt || !updatedAt) return null;
  if (o.source !== "implementation_task_list") return null;
  if (!Array.isArray(o.items)) return null;

  const items: ImplementationTaskExecutionItemV1[] = [];
  for (const row of o.items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const taskId = String(r.taskId ?? "").trim();
    const ownerRole = String(r.ownerRole ?? "").trim() as ImplementationTaskExecutionRole;
    const status = String(r.status ?? "").trim() as ImplementationTaskExecutionStatus;
    if (!taskId || !ownerRole || !status) continue;
    items.push({
      taskId,
      ownerRole,
      status,
      ...(r.sourceTaskTitle != null ? { sourceTaskTitle: String(r.sourceTaskTitle) } : {}),
      ...(r.cursorWorkItemId != null ? { cursorWorkItemId: String(r.cursorWorkItemId) } : {}),
      ...(r.codeAgentWipExecutionId != null
        ? { codeAgentWipExecutionId: String(r.codeAgentWipExecutionId) }
        : {}),
      ...(r.prototypeRunId != null ? { prototypeRunId: String(r.prototypeRunId) } : {}),
      ...(r.startedAt != null ? { startedAt: String(r.startedAt) } : {}),
      ...(r.completedAt != null ? { completedAt: String(r.completedAt) } : {}),
      ...(r.resultSummary != null ? { resultSummary: String(r.resultSummary) } : {}),
      ...(r.errorMessage != null ? { errorMessage: String(r.errorMessage) } : {}),
    });
  }

  const summaryRaw = o.summary;
  const summary =
    summaryRaw && typeof summaryRaw === "object"
      ? summarizeImplementationTaskExecutionItems(items)
      : summarizeImplementationTaskExecutionItems(items);

  return {
    version: IMPLEMENTATION_TASK_EXECUTION_STATE_VERSION,
    projectId,
    createdAt,
    updatedAt,
    source: "implementation_task_list",
    items,
    summary,
  };
}

export function buildInitialImplementationTaskExecutionStateFromTaskList(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso?: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const items: ImplementationTaskExecutionItemV1[] = (input.taskList.tasks ?? []).map((task) => ({
    taskId: task.taskId,
    ownerRole: task.ownerRole,
    status: mapTaskListStatusToExecution(task.status),
    sourceTaskTitle: task.title,
  }));
  return {
    version: IMPLEMENTATION_TASK_EXECUTION_STATE_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "implementation_task_list",
    items,
    summary: summarizeImplementationTaskExecutionItems(items),
  };
}

function patchExecutionItems(
  items: readonly ImplementationTaskExecutionItemV1[],
  patchByTaskId: ReadonlyMap<string, Partial<ImplementationTaskExecutionItemV1>>,
  nowIso: string,
): ImplementationTaskExecutionItemV1[] {
  return items.map((item) => {
    const patch = patchByTaskId.get(item.taskId);
    if (!patch) return item;
    if (TERMINAL_STATUSES.has(item.status) && patch.status && patch.status !== item.status) {
      return item;
    }
    return {
      ...item,
      ...patch,
      ...(patch.status === "in_progress" && !item.startedAt ? { startedAt: nowIso } : {}),
      ...(patch.status === "failed" || patch.status === "done"
        ? { completedAt: patch.completedAt ?? nowIso }
        : {}),
    };
  });
}

export function markDeveloperTasksInProgressForWip(input: {
  readonly state: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly taskList: ImplementationTaskListV1;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly projectId: string;
  readonly nowIso?: string;
  readonly codeAgentWipExecutionId?: string;
  readonly prototypeRunId?: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const base =
    input.state ??
    buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: input.projectId,
      taskList: input.taskList,
      nowIso: now,
    });

  const workItemByTaskId = new Map<string, CursorWorkItem>();
  for (const wi of input.cursorWorkItems) {
    if (wi.taskId) workItemByTaskId.set(wi.taskId, wi);
  }

  const patchByTaskId = new Map<string, Partial<ImplementationTaskExecutionItemV1>>();
  for (const task of input.taskList.tasks ?? []) {
    if (task.ownerRole !== "developer") continue;
    const wi = workItemByTaskId.get(task.taskId);
    if (!wi) continue;
    patchByTaskId.set(task.taskId, {
      status: "in_progress",
      cursorWorkItemId: wi.id,
      ...(input.codeAgentWipExecutionId ? { codeAgentWipExecutionId: input.codeAgentWipExecutionId } : {}),
      ...(input.prototypeRunId ? { prototypeRunId: input.prototypeRunId } : {}),
      resultSummary: "Code Agent WIP 작업 요청됨",
    });
  }

  const items = patchExecutionItems(base.items, patchByTaskId, now);
  return {
    ...base,
    updatedAt: now,
    items,
    summary: summarizeImplementationTaskExecutionItems(items),
  };
}

export function markDeveloperTasksFailedForWip(input: {
  readonly state: ImplementationTaskExecutionStateV1;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
  readonly errorMessage: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const taskIds = new Set(input.cursorWorkItems.map((w) => w.taskId).filter(Boolean));
  const patchByTaskId = new Map<string, Partial<ImplementationTaskExecutionItemV1>>();
  for (const taskId of taskIds) {
    patchByTaskId.set(taskId, {
      status: "failed",
      errorMessage: input.errorMessage.trim() || "Code Agent WIP 요청 실패",
    });
  }
  const items = patchExecutionItems(input.state.items, patchByTaskId, now);
  return {
    ...input.state,
    updatedAt: now,
    items,
    summary: summarizeImplementationTaskExecutionItems(items),
  };
}

export function formatImplementationTaskExecutionSummaryLines(
  state: ImplementationTaskExecutionStateV1 | null | undefined,
): readonly string[] {
  if (!state?.items.length) return [];
  const s = state.summary;
  return [
    "작업 실행 상태:",
    `- 준비: ${s.ready}개`,
    `- 대기: ${s.queued}개`,
    `- 진행 중: ${s.inProgress}개`,
    `- 완료: ${s.done}개`,
    `- 실패: ${s.failed}개`,
    `- 건너뜀: ${s.skipped}개`,
  ];
}
