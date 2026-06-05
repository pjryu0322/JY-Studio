import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export const MANUAL_GITHUB_VERIFY_RETRY_LABEL = "GitHub 다시 확인" as const;

const IN_FLIGHT_RUN_STATUSES = new Set<CodeTaskExecutionRunV1["status"]>([
  "github_verifying",
  "cursor_running",
  "cursor_requested",
]);

/** 순차 실행 중 GitHub 확인이 멈춘 것처럼 보일 때 사용자가 누를 수 있는 수동 재확인. */
export function shouldShowManualGithubVerifyRetry(input: {
  readonly queue: CodeTaskExecutionQueueV1 | null | undefined;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly currentCodeTaskId: string | null | undefined;
  readonly taskCursor: TaskCursorExecutionV1 | null | undefined;
}): boolean {
  if (input.queue?.status !== "running") return false;

  const cursorStatus = input.taskCursor?.status;
  if (cursorStatus === "github_verifying") return true;

  const codeTaskId = String(input.currentCodeTaskId ?? "").trim();
  if (!codeTaskId) return false;
  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  if (!run) return false;
  return IN_FLIGHT_RUN_STATUSES.has(run.status);
}
