import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildTaskCursorFailedOrchestrationPatch } from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  parseTaskCursorExecutionV1,
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
  if (!execution?.cursorRunId?.trim()) return false;
  return IN_FLIGHT_TASK_CURSOR_STATUSES.has(execution.status);
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
  readonly getLatestExecution: () => TaskCursorExecutionV1 | null | undefined;
  readonly getExecutionState?: () => import("@/lib/prototype/implementationTaskExecutionState").ImplementationTaskExecutionStateV1 | null | undefined;
  readonly isCancelled: () => boolean;
  readonly onPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onTerminal: (notice: string) => void;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) return;

  for (let round = 0; round < 270; round += 1) {
    if (input.isCancelled()) return;
    await new Promise((resolve) => setTimeout(resolve, round === 0 ? 2_000 : 10_000));
    const latestExecution =
      parseTaskCursorExecutionV1(input.getLatestExecution()) ?? input.initialExecution;
    if (!latestExecution?.cursorRunId?.trim()) return;
    if (!isInFlightTaskCursorExecution(latestExecution)) return;

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
      if (status && TERMINAL_TASK_CURSOR_STATUSES.has(status)) {
        const notice =
          pollJson.execution?.errorMessage ??
          pollJson.message ??
          (pollJson.success ? "Task Cursor 실행이 완료되었습니다." : "Task Cursor 실행에 실패했습니다.");
        input.onTerminal(notice);
        return;
      }
    } catch {
      // 단일 poll 실패는 네트워크 일시 오류일 수 있어 다음 라운드에서 재시도
    }
  }

  const timeoutPatch = buildTaskCursorFailedOrchestrationPatch({
    execution:
      parseTaskCursorExecutionV1(input.getLatestExecution()) ?? input.initialExecution,
    message: "Cloud Agent 폴링 시간 초과(45분). Cursor 대시보드에서 Agent 상태를 확인해 주세요.",
    history: input.history,
    existingTimeline: input.existingTimeline,
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
