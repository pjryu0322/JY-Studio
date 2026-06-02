import {
  getCurrentQueueCodeTaskId,
  parseCodeTaskExecutionQueueV1,
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import {
  findLatestRunForCodeTask,
  getCurrentCodeTaskRunForQueue,
  parseCodeTaskExecutionRunsV1,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isTerminalCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import {
  isInFlightTaskCursorExecution,
  isStaleAbandonedTaskCursorExecution,
} from "@/lib/prototype/taskCursorClientPollLoop";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  isCursorCloudAgentRunId,
  parseTaskCursorExecutionV1,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import {
  parseImplementationRuntimeUiSnapshotV1,
  synthesizeRuntimeStateFromUiSnapshot,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";

export const IMPLEMENTATION_RUNTIME_STATE_VERSION = "implementation_runtime_state_v1" as const;

export type RuntimeState =
  | "idle"
  | "queued"
  | "dispatching"
  | "cursor_running"
  | "github_verifying"
  | "completed"
  | "failed"
  | "stale";

export type RuntimeGithubState = "none" | "pending" | "verified" | "failed";

export type ImplementationRuntimeActiveDispatchV1 = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItemId: string;
  readonly runId: string;
}>;

export type ImplementationRuntimeStateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_RUNTIME_STATE_VERSION;
  readonly projectId: string;
  readonly runtimeState: RuntimeState;
  readonly activeCodeTaskId?: string;
  readonly activeRunId?: string;
  readonly activeDispatch?: ImplementationRuntimeActiveDispatchV1 | null;
  readonly cursorAgentStatus?: string;
  readonly cursorRunId?: string;
  readonly githubState: RuntimeGithubState;
  readonly lastStateChangeAt: string;
  readonly lastWatchdogPollAt?: string;
  readonly lastCursorAgentStatusAt?: string;
  readonly updatedAt: string;
  readonly errorMessage?: string;
}>;

export type ImplementationRuntimeDiagnosticRowV1 = Readonly<{
  readonly codeTaskId: string;
  readonly runtimeState: RuntimeState;
  readonly cursorState: string;
  readonly githubState: RuntimeGithubState;
  readonly lastUpdate: string;
}>;

const RUNTIME_STATES = new Set<RuntimeState>([
  "idle",
  "queued",
  "dispatching",
  "cursor_running",
  "github_verifying",
  "completed",
  "failed",
  "stale",
]);

export const RUNTIME_IN_FLIGHT_STATES = new Set<RuntimeState>([
  "dispatching",
  "cursor_running",
  "github_verifying",
]);

export const IMPLEMENTATION_RUNTIME_STALE_MINUTES = 30 as const;
export const IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES = 5 as const;

export function isRuntimeInFlight(state: RuntimeState | null | undefined): boolean {
  return Boolean(state && RUNTIME_IN_FLIGHT_STATES.has(state));
}

export function formatRuntimeStateKo(state: RuntimeState): string {
  switch (state) {
    case "idle":
      return "대기";
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    case "cursor_running":
      return "cursor_running";
    case "github_verifying":
      return "github_verifying";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "stale":
      return "stale";
    default:
      return state;
  }
}

export function parseImplementationRuntimeStateV1(raw: unknown): ImplementationRuntimeStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IMPLEMENTATION_RUNTIME_STATE_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const runtimeState = String(o.runtimeState ?? "").trim() as RuntimeState;
  const lastStateChangeAt = String(o.lastStateChangeAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  const githubState = String(o.githubState ?? "none").trim() as RuntimeGithubState;
  if (!projectId || !RUNTIME_STATES.has(runtimeState) || !lastStateChangeAt || !updatedAt) {
    return null;
  }
  const activeDispatchRaw = o.activeDispatch;
  let activeDispatch: ImplementationRuntimeActiveDispatchV1 | null | undefined;
  if (activeDispatchRaw && typeof activeDispatchRaw === "object") {
    const d = activeDispatchRaw as Record<string, unknown>;
    const codeTaskId = String(d.codeTaskId ?? "").trim();
    const parentTaskId = String(d.parentTaskId ?? "").trim();
    const workItemId = String(d.workItemId ?? "").trim();
    const runId = String(d.runId ?? "").trim();
    if (codeTaskId && parentTaskId && workItemId && runId) {
      activeDispatch = { codeTaskId, parentTaskId, workItemId, runId };
    }
  }
  return {
    version: IMPLEMENTATION_RUNTIME_STATE_VERSION,
    projectId,
    runtimeState,
    githubState: githubState === "pending" || githubState === "verified" || githubState === "failed"
      ? githubState
      : "none",
    lastStateChangeAt,
    updatedAt,
    activeDispatch: activeDispatch ?? null,
    ...(typeof o.activeCodeTaskId === "string" && o.activeCodeTaskId.trim()
      ? { activeCodeTaskId: o.activeCodeTaskId.trim() }
      : {}),
    ...(typeof o.activeRunId === "string" && o.activeRunId.trim()
      ? { activeRunId: o.activeRunId.trim() }
      : {}),
    ...(typeof o.cursorAgentStatus === "string" && o.cursorAgentStatus.trim()
      ? { cursorAgentStatus: o.cursorAgentStatus.trim() }
      : {}),
    ...(typeof o.cursorRunId === "string" && o.cursorRunId.trim()
      ? { cursorRunId: o.cursorRunId.trim() }
      : {}),
    ...(typeof o.lastWatchdogPollAt === "string" && o.lastWatchdogPollAt.trim()
      ? { lastWatchdogPollAt: o.lastWatchdogPollAt.trim() }
      : {}),
    ...(typeof o.lastCursorAgentStatusAt === "string" && o.lastCursorAgentStatusAt.trim()
      ? { lastCursorAgentStatusAt: o.lastCursorAgentStatusAt.trim() }
      : {}),
    ...(typeof o.errorMessage === "string" && o.errorMessage.trim()
      ? { errorMessage: o.errorMessage.trim() }
      : {}),
  };
}

function mapRunStatusToRuntimeState(
  run: CodeTaskExecutionRunV1 | null | undefined,
  execution: TaskCursorExecutionV1 | null | undefined,
): RuntimeState {
  if (execution && isInFlightTaskCursorExecution(execution)) {
    if (execution.status === "github_verifying") return "github_verifying";
    if (
      execution.status === "cursor_running" ||
      execution.status === "cursor_requested" ||
      isCursorCloudAgentRunId(execution.cursorRunId)
    ) {
      return "cursor_running";
    }
    return "dispatching";
  }
  if (!run) return "idle";
  switch (run.status) {
    case "queued":
      return "queued";
    case "prompt_building":
    case "cursor_requested":
      return "dispatching";
    case "cursor_running":
      return "cursor_running";
    case "github_verifying":
      return "github_verifying";
    case "completed":
    case "no_code_change_completed":
      return "completed";
    case "failed":
    case "blocked_by_dependency":
      return "failed";
    case "status_check_stopped":
      return run.failureReason === "execution_stale" ? "stale" : "failed";
    case "rework_required":
      return "failed";
    default:
      return "idle";
  }
}

function mapGithubState(
  execution: TaskCursorExecutionV1 | null | undefined,
  run: CodeTaskExecutionRunV1 | null | undefined,
): RuntimeGithubState {
  if (execution?.status === "github_verified" || run?.status === "completed") return "verified";
  if (execution?.status === "github_verify_failed") return "failed";
  if (execution?.status === "github_verifying" || run?.status === "github_verifying") {
    return "pending";
  }
  return "none";
}

/** queue / runs / taskCursor에서 Runtime SoT를 유도한다. */
export function deriveImplementationRuntimeState(input: {
  readonly projectId: string;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursor?: TaskCursorExecutionV1 | null;
  readonly existing?: ImplementationRuntimeStateV1 | null;
  readonly nowIso?: string;
}): ImplementationRuntimeStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const queue = input.queue ?? null;
  const runs = input.runs ?? [];
  const execution = input.taskCursor ?? null;
  const headCodeTaskId = queue ? getCurrentQueueCodeTaskId(queue) : null;
  const headRun = getCurrentCodeTaskRunForQueue(queue, runs);
  const runtimeState = mapRunStatusToRuntimeState(headRun, execution);
  const githubState = mapGithubState(execution, headRun);

  let activeDispatch: ImplementationRuntimeActiveDispatchV1 | null = null;
  if (headRun && headCodeTaskId && isRuntimeInFlight(runtimeState)) {
    activeDispatch = {
      codeTaskId: headCodeTaskId,
      parentTaskId: headRun.processTaskId,
      workItemId: headRun.workItemId,
      runId: headRun.runId,
    };
  } else if (
    headRun &&
    headCodeTaskId &&
    runtimeState === "queued" &&
    input.existing?.activeDispatch?.codeTaskId === headCodeTaskId
  ) {
    activeDispatch = input.existing.activeDispatch;
  } else if (input.existing?.activeDispatch && isRuntimeInFlight(runtimeState)) {
    activeDispatch = input.existing.activeDispatch;
  }

  const cursorAgentStatus = execution?.cursorAgentStatus?.trim() || undefined;
  const prevAgentStatus = input.existing?.cursorAgentStatus;
  const agentStatusChanged = Boolean(
    cursorAgentStatus && cursorAgentStatus !== prevAgentStatus,
  );
  const prevRuntime = input.existing?.runtimeState;
  const stateChanged = prevRuntime !== runtimeState;

  return {
    version: IMPLEMENTATION_RUNTIME_STATE_VERSION,
    projectId: input.projectId.trim(),
    runtimeState,
    githubState,
    lastStateChangeAt: stateChanged ? now : input.existing?.lastStateChangeAt ?? now,
    updatedAt: now,
    activeDispatch,
    ...(headCodeTaskId ? { activeCodeTaskId: headCodeTaskId } : {}),
    ...(headRun ? { activeRunId: headRun.runId } : {}),
    ...(cursorAgentStatus ? { cursorAgentStatus } : {}),
    ...(execution?.cursorRunId?.trim() ? { cursorRunId: execution.cursorRunId.trim() } : {}),
    ...(agentStatusChanged || stateChanged
      ? { lastCursorAgentStatusAt: now }
      : input.existing?.lastCursorAgentStatusAt
        ? { lastCursorAgentStatusAt: input.existing.lastCursorAgentStatusAt }
        : {}),
    ...(input.existing?.lastWatchdogPollAt
      ? { lastWatchdogPollAt: input.existing.lastWatchdogPollAt }
      : {}),
    ...(execution?.errorMessage?.trim() ? { errorMessage: execution.errorMessage.trim() } : {}),
  };
}

export function deriveImplementationRuntimeFromRequirementsState(input: {
  readonly raw: Record<string, unknown>;
  readonly projectId: string;
  readonly nowIso?: string;
}): ImplementationRuntimeStateV1 {
  const queue = parseCodeTaskExecutionQueueV1(input.raw.codeTaskExecutionQueueV1);
  const runs = parseCodeTaskExecutionRunsV1(input.raw.codeTaskExecutionRunsV1);
  const taskCursor = parseTaskCursorExecutionV1(input.raw.taskCursorExecutionV1);
  const snapshot = parseImplementationRuntimeUiSnapshotV1(input.raw.implementationRuntimeUiSnapshotV1);
  const existing = snapshot
    ? synthesizeRuntimeStateFromUiSnapshot(snapshot, input.projectId)
    : parseImplementationRuntimeStateV1(input.raw.implementationRuntimeStateV1);
  return deriveImplementationRuntimeState({
    projectId: input.projectId,
    queue,
    runs,
    taskCursor,
    existing,
    nowIso: input.nowIso,
  });
}

export function getActiveRuntimeDispatch(
  runtime: ImplementationRuntimeStateV1 | null | undefined,
): ImplementationRuntimeActiveDispatchV1 | null {
  return runtime?.activeDispatch ?? null;
}

export function buildRuntimeDiagnosticRows(input: {
  readonly runtime: ImplementationRuntimeStateV1 | null | undefined;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursor?: TaskCursorExecutionV1 | null;
}): readonly ImplementationRuntimeDiagnosticRowV1[] {
  const runtime = input.runtime;
  if (!runtime) return [];
  const rows: ImplementationRuntimeDiagnosticRowV1[] = [];
  const selected = input.queue?.selectedCodeTaskIds ?? [];
  if (selected.length) {
    for (const codeTaskId of selected) {
      const run = findLatestRunForCodeTask(input.runs, codeTaskId);
      const isActive = codeTaskId === runtime.activeCodeTaskId;
      rows.push({
        codeTaskId,
        runtimeState: isActive ? runtime.runtimeState : mapRunStatusToRuntimeState(run, null),
        cursorState: isActive
          ? String(input.taskCursor?.cursorAgentStatus ?? input.taskCursor?.status ?? "—")
          : "—",
        githubState: isActive ? runtime.githubState : mapGithubState(null, run),
        lastUpdate: run?.updatedAt ?? runtime.updatedAt,
      });
    }
    return rows;
  }
  rows.push({
    codeTaskId: runtime.activeCodeTaskId ?? "—",
    runtimeState: runtime.runtimeState,
    cursorState: String(input.taskCursor?.cursorAgentStatus ?? input.taskCursor?.status ?? "—"),
    githubState: runtime.githubState,
    lastUpdate: runtime.updatedAt,
  });
  return rows;
}

function minutesSince(iso: string | undefined, nowMs: number): number | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const ms = nowMs - Date.parse(raw);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}

export type RuntimeRecoveryIssue =
  | "orphan_queued"
  | "orphan_dispatching"
  | "orphan_cursor_running"
  | "watchdog_poll"
  | "stale";

export type RuntimeRecoveryPlan = Readonly<{
  readonly issues: readonly RuntimeRecoveryIssue[];
  readonly shouldRedispatch: boolean;
  readonly shouldWatchdogPoll: boolean;
  readonly markStale: boolean;
  readonly markFailed: boolean;
}>;

export function evaluateRuntimeRecovery(input: {
  readonly runtime: ImplementationRuntimeStateV1;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): RuntimeRecoveryPlan {
  const nowMs = Date.parse(input.nowIso ?? new Date().toISOString());
  const issues: RuntimeRecoveryIssue[] = [];
  const queue = input.queue;
  const runs = input.runs ?? [];
  const execution = input.taskCursor ?? null;
  const headRun = getCurrentCodeTaskRunForQueue(queue, runs);

  let shouldRedispatch = false;
  let shouldWatchdogPoll = false;
  let markStale = false;
  let markFailed = false;

  if (
    queue?.status === "running" &&
    input.runtime.runtimeState === "queued" &&
    !execution &&
    (!headRun || headRun.status === "queued")
  ) {
    issues.push("orphan_queued");
    shouldRedispatch = true;
  }

  if (
    input.runtime.runtimeState === "dispatching" &&
    !isInFlightTaskCursorExecution(execution) &&
    !isCursorCloudAgentRunId(execution?.cursorRunId)
  ) {
    const dispatchAge = minutesSince(input.runtime.lastStateChangeAt, nowMs);
    if (dispatchAge != null && dispatchAge >= IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES) {
      issues.push("orphan_dispatching");
      markFailed = true;
    }
  }

  if (input.runtime.runtimeState === "cursor_running" && execution) {
    const statusAnchor =
      input.runtime.lastCursorAgentStatusAt ??
      execution.updatedAt ??
      execution.createdAt;
    const stallMinutes = minutesSince(statusAnchor, nowMs);
    if (stallMinutes != null && stallMinutes >= IMPLEMENTATION_RUNTIME_WATCHDOG_STALL_MINUTES) {
      issues.push("watchdog_poll");
      shouldWatchdogPoll = true;
    }
    if (
      isStaleAbandonedTaskCursorExecution(execution, {
        staleMinutes: IMPLEMENTATION_RUNTIME_STALE_MINUTES,
      }) ||
      (stallMinutes != null && stallMinutes >= IMPLEMENTATION_RUNTIME_STALE_MINUTES)
    ) {
      issues.push("orphan_cursor_running");
      markStale = true;
    }
  }

  if (
    headRun &&
    isTerminalCodeTaskExecutionRunStatus(headRun.status) &&
    isRuntimeInFlight(input.runtime.runtimeState)
  ) {
    markFailed = true;
  }

  return { issues, shouldRedispatch, shouldWatchdogPoll, markStale, markFailed };
}

export function patchRuntimeWatchdogPoll(
  runtime: ImplementationRuntimeStateV1,
  nowIso?: string,
): ImplementationRuntimeStateV1 {
  const now = nowIso ?? new Date().toISOString();
  return { ...runtime, lastWatchdogPollAt: now, updatedAt: now };
}

export function patchRuntimeState(
  runtime: ImplementationRuntimeStateV1,
  patch: Partial<Pick<ImplementationRuntimeStateV1, "runtimeState" | "errorMessage" | "githubState">> & {
    readonly nowIso?: string;
  },
): ImplementationRuntimeStateV1 {
  const now = patch.nowIso ?? new Date().toISOString();
  const stateChanged = patch.runtimeState != null && patch.runtimeState !== runtime.runtimeState;
  return {
    ...runtime,
    ...patch,
    updatedAt: now,
    ...(stateChanged ? { lastStateChangeAt: now } : {}),
  };
}

export function clearRuntimeActiveDispatch(
  runtime: ImplementationRuntimeStateV1,
  nowIso?: string,
): ImplementationRuntimeStateV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    ...runtime,
    activeDispatch: null,
    updatedAt: now,
  };
}

export function buildRuntimeStateWithActiveDispatch(input: {
  readonly projectId: string;
  readonly dispatch: ImplementationRuntimeActiveDispatchV1;
  readonly baseState: Record<string, unknown>;
  readonly nowIso?: string;
}): ImplementationRuntimeStateV1 {
  const derived = deriveImplementationRuntimeFromRequirementsState({
    raw: input.baseState,
    projectId: input.projectId,
    nowIso: input.nowIso,
  });
  const now = input.nowIso ?? new Date().toISOString();
  return {
    ...derived,
    runtimeState: "queued",
    activeDispatch: input.dispatch,
    activeCodeTaskId: input.dispatch.codeTaskId,
    activeRunId: input.dispatch.runId,
    lastStateChangeAt: now,
    updatedAt: now,
  };
}

export function buildActiveDispatchForQueueHead(input: {
  readonly projectId: string;
  readonly queue: CodeTaskExecutionQueueV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly nowIso?: string;
}): ImplementationRuntimeActiveDispatchV1 | null {
  const codeTaskId = getCurrentQueueCodeTaskId(input.queue);
  if (!codeTaskId) return null;
  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  if (!run || run.status !== "queued") return null;
  return {
    codeTaskId,
    parentTaskId: run.processTaskId,
    workItemId: run.workItemId,
    runId: run.runId,
  };
}

export function isImplementationExecutionRuntimeActive(input: {
  readonly quickRunStatus?: string | null;
  readonly queueStatus?: string | null;
  readonly runtime?: ImplementationRuntimeStateV1 | null;
}): boolean {
  if (isRuntimeInFlight(input.runtime?.runtimeState)) return true;
  if (input.queueStatus === "running") return true;
  return input.quickRunStatus === "running";
}
