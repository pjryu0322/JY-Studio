import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildPromptTimelineOrchestrationPatch,
  buildTaskCursorPollLifecycleTimelineEntry,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildTaskCursorFailedOrchestrationPatch } from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  isCursorCloudAgentRunId,
  parseTaskCursorExecutionV1,
  TASK_CURSOR_POLL_CANCELLED_MESSAGE,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

const TERMINAL_TASK_CURSOR_STATUSES = new Set([
  "cursor_completed",
  "cursor_failed",
  "github_verified",
  "github_verify_failed",
  "review_pending",
  "security_pending",
  "scm_pending",
  "blocked",
]);

const IN_FLIGHT_TASK_CURSOR_STATUSES = new Set([
  "cursor_requested",
  "cursor_running",
  "github_verifying",
]);

export function isInFlightTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  return IN_FLIGHT_TASK_CURSOR_STATUSES.has(execution.status);
}

/** persisted requirementsStateJson에서 in-flight Cursor 폴링을 모두 해제한다. */
export function releaseAllInFlightTaskCursorPollingFromRequirementsState(
  raw: unknown,
  nowIso?: string,
): { readonly next: Record<string, unknown>; readonly releasedTaskIds: readonly string[] } {
  const now = nowIso ?? new Date().toISOString();
  if (!raw || typeof raw !== "object") {
    return { next: {}, releasedTaskIds: [] };
  }
  const source = raw as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  const releasedTaskIds: string[] = [];

  const execution = parseTaskCursorExecutionV1(source.taskCursorExecutionV1);
  if (execution && isInFlightTaskCursorExecution(execution)) {
    releasedTaskIds.push(execution.taskId);
    next.taskCursorExecutionV1 = {
      ...execution,
      status: "status_check_stopped",
      errorMessage: TASK_CURSOR_POLL_CANCELLED_MESSAGE,
      updatedAt: now,
    };
  }

  const quickRunRaw = source.implementationQuickRunV1;
  if (quickRunRaw && typeof quickRunRaw === "object") {
    const status = String((quickRunRaw as Record<string, unknown>).status ?? "").trim();
    if (status === "running") {
      next.implementationQuickRunV1 = {
        ...(quickRunRaw as Record<string, unknown>),
        status: "paused",
        updatedAt: now,
        blockedReason: "폴링 일괄 해제",
      };
    }
  }

  return { next, releasedTaskIds };
}

/** 폴링이 끊긴 채 persisted state만 in-flight로 남은 실행 */
export function isStaleAbandonedTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
  input?: { readonly developerStatus?: string | null },
): boolean {
  if (!execution || !isInFlightTaskCursorExecution(execution)) return false;
  if (input?.developerStatus === "failed") return true;
  if (isTaskCursorStatusCheckStopped(execution)) return true;
  if (execution.status === "cursor_running" && !isCursorCloudAgentRunId(execution.cursorRunId)) {
    return true;
  }
  if (execution.status === "cursor_requested" && !String(execution.cursorRunId ?? "").trim()) {
    return true;
  }
  return false;
}

/** 다른 Task 실행/재시작을 막아야 하는 실제 in-flight Cursor 실행 */
export function isActiveTaskCursorExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
  input?: { readonly developerStatus?: string | null },
): execution is TaskCursorExecutionV1 {
  if (!execution || !isInFlightTaskCursorExecution(execution)) return false;
  return !isStaleAbandonedTaskCursorExecution(execution, input);
}

export { TASK_CURSOR_POLL_CANCELLED_MESSAGE } from "@/lib/prototype/taskCursorExecution";

export function isTaskCursorStatusCheckStopped(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  if (execution.status === "status_check_stopped") return true;
  if (execution.failureReason === "poll_cancelled" && execution.status === "cursor_failed") {
    return true;
  }
  const message = String(execution.errorMessage ?? "").trim();
  return (
    message === TASK_CURSOR_POLL_CANCELLED_MESSAGE ||
    message.includes("상태 확인을 중단")
  );
}

/** @deprecated Use isTaskCursorStatusCheckStopped */
export function isTaskCursorPollCancelledExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  return isTaskCursorStatusCheckStopped(execution);
}

/** Cloud Agent runId가 있으면 플랫폼 상태 확인만 재개할 수 있다 (Cursor run 취소 API 없음). */
export function isTaskCursorStatusCheckResumable(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!isTaskCursorStatusCheckStopped(execution)) return false;
  return isCursorCloudAgentRunId(execution.cursorRunId);
}

/** Cloud Agent 폴링은 launch 응답의 `bc-<uuid>` runId가 있을 때만 시작한다. */
export function canPollTaskCursorCloudAgent(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  if (execution.status !== "cursor_running" && execution.status !== "github_verifying") {
    return false;
  }
  return isCursorCloudAgentRunId(execution.cursorRunId);
}

/** UI에서 Cloud Agent 폴링 중단 버튼 표시 여부 */
export function isTaskCursorCloudAgentPollingCancellable(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  if (!execution) return false;
  if (execution.status === "cursor_requested") return true;
  return canPollTaskCursorCloudAgent(execution);
}

export function resolveTaskCursorPollWorkItems(
  execution: TaskCursorExecutionV1,
  allWorkItems: readonly CursorWorkItem[],
): readonly CursorWorkItem[] {
  if (execution.workItemIds.length > 0) {
    const idSet = new Set(execution.workItemIds);
    const byIds = allWorkItems.filter((item) => idSet.has(item.id));
    if (byIds.length) return byIds;
  }
  const byTask = allWorkItems.filter((item) => item.taskId === execution.taskId);
  return byTask.length ? byTask : allWorkItems;
}

export async function runTaskCursorClientPollLoop(input: {
  readonly projectId: string;
  readonly initialExecution: TaskCursorExecutionV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly existingTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly getExistingTimeline?: () => readonly RequirementsPromptTimelineEntry[] | null | undefined;
  readonly getLatestExecution: () => TaskCursorExecutionV1 | null | undefined;
  readonly getExecutionState?: () => import("@/lib/prototype/implementationTaskExecutionState").ImplementationTaskExecutionStateV1 | null | undefined;
  readonly isCancelled: () => boolean;
  readonly onPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onTerminal: (notice: string) => void;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) return;

  let lastLoggedAgentStatus = "";
  const resolveExistingTimeline = (): readonly RequirementsPromptTimelineEntry[] =>
    input.getExistingTimeline?.() ?? input.existingTimeline ?? [];

  for (let round = 0; round < 270; round += 1) {
    if (input.isCancelled()) return;
    await new Promise((resolve) => setTimeout(resolve, round === 0 ? 2_000 : 10_000));
    const latestExecution =
      parseTaskCursorExecutionV1(input.getLatestExecution()) ?? input.initialExecution;
    if (!canPollTaskCursorCloudAgent(latestExecution)) return;

    try {
      const pollRes = await credentialsIncludeFetch("/api/prototype/task-cursor/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          taskCursorExecutionV1: latestExecution,
          workItems: input.workItems,
          verifyGithub: true,
          ...(input.getExecutionState?.()
            ? { implementationTaskExecutionStateV1: input.getExecutionState() }
            : {}),
        }),
      });
      const pollJson = (await pollRes.json()) as {
        success?: boolean;
        status?: string;
        agentStatus?: string;
        message?: string;
        execution?: { status?: string; errorMessage?: string };
        orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
      };
      if (pollJson.orchestrationPatch) {
        input.onPatch(pollJson.orchestrationPatch);
      }
      const agentStatus = String(pollJson.agentStatus ?? "").trim();
      const status = String(pollJson.execution?.status ?? pollJson.status ?? "").trim();
      if (status === "blocked") {
        const notice =
          pollJson.message ??
          pollJson.execution?.errorMessage ??
          "Task Cursor 폴링이 차단되었습니다. 환경설정을 확인해 주세요.";
        const blockedPatch = buildTaskCursorFailedOrchestrationPatch({
          execution: latestExecution,
          message: notice,
          history: input.history,
          existingTimeline: input.existingTimeline,
        });
        input.onPatch(blockedPatch);
        input.onTerminal(notice);
        return;
      }
      if (status === "poll_not_ready") {
        continue;
      }
      if (status && TERMINAL_TASK_CURSOR_STATUSES.has(status)) {
        const notice =
          pollJson.execution?.errorMessage ??
          pollJson.message ??
          (pollJson.success ? "Task Cursor 실행이 완료되었습니다." : "Task Cursor 실행에 실패했습니다.");
        input.onTerminal(notice);
        return;
      }
      const shouldLogTick =
        Boolean(agentStatus && agentStatus !== lastLoggedAgentStatus) ||
        round % 3 === 0 ||
        (status && status !== "poll_not_ready" && status !== "cursor_running");
      if (shouldLogTick) {
        if (agentStatus) lastLoggedAgentStatus = agentStatus;
        input.onPatch(
          buildPromptTimelineOrchestrationPatch(
            resolveExistingTimeline(),
            buildTaskCursorPollLifecycleTimelineEntry({
              action: "task_cursor_poll_tick",
              projectId: pid,
              taskId: latestExecution.taskId,
              runId: latestExecution.cursorRunId,
              round: round + 1,
              agentStatus: agentStatus || undefined,
              executionStatus: status || latestExecution.status,
              message: pollJson.message,
            }),
          ),
        );
      }
    } catch {
      // 단일 poll 실패는 네트워크 일시 오류일 수 있어 다음 라운드에서 재시도
    }
  }

  const timedOutExecution =
    parseTaskCursorExecutionV1(input.getLatestExecution()) ?? input.initialExecution;
  input.onPatch(
    buildPromptTimelineOrchestrationPatch(
      resolveExistingTimeline(),
      buildTaskCursorPollLifecycleTimelineEntry({
        action: "task_cursor_poll_timeout",
        projectId: pid,
        taskId: timedOutExecution.taskId,
        runId: timedOutExecution.cursorRunId,
        round: 270,
        executionStatus: timedOutExecution.status,
        message: "Cloud Agent 폴링 시간 초과(45분). Cursor 대시보드에서 Agent 상태를 확인해 주세요.",
      }),
    ),
  );
  const timeoutPatch = buildTaskCursorFailedOrchestrationPatch({
    execution: timedOutExecution,
    message: "Cloud Agent 폴링 시간 초과(45분). Cursor 대시보드에서 Agent 상태를 확인해 주세요.",
    history: input.history,
    existingTimeline: resolveExistingTimeline(),
  });
  input.onPatch(timeoutPatch);
  input.onTerminal("Task Cursor 폴링 시간 초과");
}

export function formatTaskCursorElapsedMinutes(iso?: string | null): number | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const ms = Date.now() - Date.parse(raw);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}
