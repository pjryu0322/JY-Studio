import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
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

const IMPLEMENTATION_TASK_EXECUTION_ROLES = new Set<ImplementationTaskExecutionRole>([
  "developer",
  "designer",
  "reviewer",
  "security",
  "scm",
]);

const IMPLEMENTATION_TASK_EXECUTION_STATUSES = new Set<ImplementationTaskExecutionStatus>([
  "ready",
  "queued",
  "in_progress",
  "done",
  "failed",
  "skipped",
]);

export function isImplementationTaskExecutionRole(
  value: string,
): value is ImplementationTaskExecutionRole {
  return IMPLEMENTATION_TASK_EXECUTION_ROLES.has(value as ImplementationTaskExecutionRole);
}

export function isImplementationTaskExecutionStatus(
  value: string,
): value is ImplementationTaskExecutionStatus {
  return IMPLEMENTATION_TASK_EXECUTION_STATUSES.has(value as ImplementationTaskExecutionStatus);
}

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

const POST_DEVELOPER_REVIEW_ROLES = new Set<ImplementationTaskExecutionRole>([
  "reviewer",
  "security",
  "scm",
]);

const DEFAULT_POST_DEVELOPER_QUEUE_REASON = "AI 개발자 WIP 승인 후 후속 점검 대기";

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
    const ownerRoleRaw = String(r.ownerRole ?? "").trim();
    const statusRaw = String(r.status ?? "").trim();
    if (!taskId || !isImplementationTaskExecutionRole(ownerRoleRaw)) continue;
    if (!isImplementationTaskExecutionStatus(statusRaw)) continue;
    const ownerRole = ownerRoleRaw;
    const status = statusRaw;
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

  const summary = summarizeImplementationTaskExecutionItems(items);

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

function applyExecutionStateItemPatches(
  state: ImplementationTaskExecutionStateV1,
  patchForItem: (
    item: ImplementationTaskExecutionItemV1,
  ) => Partial<ImplementationTaskExecutionItemV1> | null,
  nowIso: string,
): ImplementationTaskExecutionStateV1 {
  const patchByTaskId = new Map<string, Partial<ImplementationTaskExecutionItemV1>>();
  for (const item of state.items) {
    const patch = patchForItem(item);
    if (patch) patchByTaskId.set(item.taskId, patch);
  }
  const items = patchExecutionItems(state.items, patchByTaskId, nowIso);
  return {
    ...state,
    updatedAt: nowIso,
    items,
    summary: summarizeImplementationTaskExecutionItems(items),
  };
}

export function hasDeveloperWipApprovedWithReviewQueued(
  executionState: ImplementationTaskExecutionStateV1 | null | undefined,
): boolean {
  if (!executionState?.items.length) return false;
  const developerDone = executionState.items.some(
    (item) => item.ownerRole === "developer" && item.status === "done",
  );
  const postReviewQueued = executionState.items.some(
    (item) => POST_DEVELOPER_REVIEW_ROLES.has(item.ownerRole) && item.status === "queued",
  );
  return developerDone && postReviewQueued;
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

export function markDeveloperTasksDoneForWip(input: {
  readonly state: ImplementationTaskExecutionStateV1;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
  readonly resultSummary?: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.resultSummary?.trim() || "Code Agent WIP 작업 완료";
  const taskIds = new Set(input.cursorWorkItems.map((w) => w.taskId).filter(Boolean));
  const patchByTaskId = new Map<string, Partial<ImplementationTaskExecutionItemV1>>();
  for (const taskId of taskIds) {
    patchByTaskId.set(taskId, {
      status: "done",
      resultSummary: summary,
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

export function markPostDeveloperReviewTasksQueued(input: {
  readonly state: ImplementationTaskExecutionStateV1;
  readonly nowIso?: string;
  readonly reason?: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const resultSummary = input.reason?.trim() || DEFAULT_POST_DEVELOPER_QUEUE_REASON;
  return applyExecutionStateItemPatches(
    input.state,
    (item) => {
      if (!POST_DEVELOPER_REVIEW_ROLES.has(item.ownerRole) || item.status !== "ready") return null;
      return { status: "queued", resultSummary };
    },
    now,
  );
}

export function markRoleTasksInProgress(input: {
  readonly state: ImplementationTaskExecutionStateV1;
  readonly ownerRole: ImplementationTaskExecutionRole;
  readonly nowIso?: string;
  readonly resultSummary?: string;
}): ImplementationTaskExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const resultSummary = input.resultSummary?.trim() || `${input.ownerRole} 작업 진행 중`;
  return applyExecutionStateItemPatches(
    input.state,
    (item) => {
      if (item.ownerRole !== input.ownerRole) return null;
      if (item.status !== "ready" && item.status !== "queued") return null;
      return { status: "in_progress", resultSummary };
    },
    now,
  );
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

const WIP_ACTIVE_STATUSES = new Set<CodeAgentWipExecutionV1["status"]>([
  "requested",
  "drafting",
  "refactoring",
  "wip_committed",
  "developer_reviewing",
  "refactor_requested",
  "wip_updated",
]);

const WIP_DONE_STATUSES = new Set<CodeAgentWipExecutionV1["status"]>([
  "developer_approved",
  "scm_commit_pending",
]);

export function syncDeveloperTaskExecutionFromCodeAgentWip(input: {
  readonly state: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly codeAgentWipExecutionV1: CodeAgentWipExecutionV1 | null | undefined;
  readonly projectId: string;
  readonly nowIso?: string;
}): ImplementationTaskExecutionStateV1 | null {
  if (!input.state && !input.taskList?.tasks?.length) return null;
  if (!input.codeAgentWipExecutionV1) return input.state ?? null;
  if (!input.cursorWorkItems.length) return input.state ?? null;

  const now = input.nowIso ?? new Date().toISOString();
  const projectId = input.projectId.trim();
  const taskList = input.taskList;
  const wipStatus = input.codeAgentWipExecutionV1.status;

  let base =
    input.state ??
    (taskList
      ? buildInitialImplementationTaskExecutionStateFromTaskList({
          projectId,
          taskList,
          nowIso: now,
        })
      : null);
  if (!base) return null;

  if (wipStatus === "failed") {
    return markDeveloperTasksFailedForWip({
      state: base,
      cursorWorkItems: input.cursorWorkItems,
      nowIso: now,
      errorMessage: "Code Agent WIP 작업 실패",
    });
  }

  if (WIP_ACTIVE_STATUSES.has(wipStatus)) {
    if (!taskList) return base;
    return markDeveloperTasksInProgressForWip({
      state: base,
      taskList,
      cursorWorkItems: input.cursorWorkItems,
      projectId,
      nowIso: now,
    });
  }

  if (WIP_DONE_STATUSES.has(wipStatus)) {
    return markDeveloperTasksDoneForWip({
      state: base,
      cursorWorkItems: input.cursorWorkItems,
      nowIso: now,
    });
  }

  return base;
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
