import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

/** P3-M41: 구현 Runtime의 필수 레이어 — 완료/진행 판정은 code_task_run만 SoT */
export type ImplementationRuntimeLayer =
  | "code_task_run"
  | "runtime_queue"
  | "cursor_session"
  | "event_log"
  | "derived_ui_view";

/** JSON `CodeTaskExecutionRunV1` — CodeTask 상태·GitHub/Quality outcome SoT */
export type CodeTaskRun = CodeTaskExecutionRunV1;

/** `promptTimeline` 등 append-only 이벤트 — 현재 상태 판정에 사용하지 않음 */
export type ImplementationExecutionEvent = Readonly<{
  readonly eventId: string;
  readonly runId?: string | null;
  readonly codeTaskId?: string | null;
  readonly type: string;
  readonly payload?: unknown;
  readonly createdAt: string;
}>;
