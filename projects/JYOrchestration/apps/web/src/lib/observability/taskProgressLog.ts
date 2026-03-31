import { appendFile } from "node:fs/promises";

/**
 * AI Task 생성·확정부터 실행 루프까지 단계별 상태를 NDJSON 한 줄씩 파일에 남긴다.
 * `JY_TASK_PROGRESS_LOG_FILE`에 절대 경로를 두면 활성화된다(미설정 시 no-op).
 */
let appendChain: Promise<void> = Promise.resolve();

export type TaskProgressLogEntry = {
  kind: string;
  phase: string;
  projectId: string;
  taskId?: string;
  specVersionId?: string;
  userId?: string;
  detail?: Record<string, unknown>;
};

export function isTaskProgressLogEnabled(): boolean {
  return Boolean(process.env.JY_TASK_PROGRESS_LOG_FILE?.trim());
}

/** Cursor Agent 폴링(status=…) 각 회차를 파일에 남길지 — `JY_TASK_PROGRESS_LOG_FILE`과 함께 `1`이어야 함 */
export function isTaskProgressCursorPollEnabled(): boolean {
  return isTaskProgressLogEnabled() && process.env.JY_TASK_PROGRESS_LOG_CURSOR_POLL === "1";
}

/** Cursor Agent poll 응답 일부(target 등)를 추가로 덤프할지(노이즈 많음) */
export function isTaskProgressCursorPollDumpEnabled(): boolean {
  return isTaskProgressLogEnabled() && process.env.JY_TASK_PROGRESS_LOG_CURSOR_POLL_DUMP === "1";
}

export function appendTaskProgressLog(entry: TaskProgressLogEntry): void {
  const path = process.env.JY_TASK_PROGRESS_LOG_FILE?.trim();
  if (!path) return;
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    }) + "\n";
  appendChain = appendChain
    .then(() => appendFile(path, line, "utf8"))
    .catch((err) => {
      console.error("[task-progress-log] append failed:", err);
    });
}
