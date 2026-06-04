/** 구현단계 반복 runtime/poll/verify 이벤트 — 채팅 카드·toast 억제 */

export type ImplementationStatusMessageKey = Readonly<{
  readonly action: string;
  readonly taskId?: string | null;
  readonly codeTaskId?: string | null;
  readonly reason?: string | null;
}>;

const ROUTINE_CHAT_CONTENT_PATTERNS: readonly RegExp[] = [
  /^GitHub commit 확인 (완료|실패)/,
  /GitHub commit 결과를 확인/,
  /GitHub branch에서 commit 확인/,
  /검수 자동 점검이 완료/,
  /경량 자동검사/,
  /보안 점검·SCM merge는 모든 Task 완료 후/,
  /우선순위 기준 다음 작업을 자동으로 시작/,
  / · GitHub commit 확인/,
  / · 진행 중인 Cloud Agent 폴링 재개/,
  /^AI 개발자 · GitHub/,
  /^AI 개발자 · 검수 자동/,
];

const ROUTINE_APPEND_ACTIONS = new Set([
  "task_cursor_poll_tick",
  "task_cursor_github_verify_requested",
  "task_cursor_github_verified",
  "task_cursor_github_verify_failed",
  "task_cursor_github_fallback_verify_started",
  "task_cursor_github_fallback_verify_completed",
  "implementation_auto_quality_gate_passed",
  "implementation_auto_quality_gate_review_running",
]);

export function isRoutineImplementationStatusChatContent(content: string): boolean {
  const text = String(content ?? "").trim();
  if (!text) return false;
  return ROUTINE_CHAT_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldSuppressImplementationStatusMessage(input: {
  readonly action?: string | null;
  readonly content?: string | null;
  readonly taskId?: string | null;
  readonly codeTaskId?: string | null;
  readonly reason?: string | null;
  readonly previous?: ImplementationStatusMessageKey | null;
}): boolean {
  const action = String(input.action ?? "").trim();
  if (action && ROUTINE_APPEND_ACTIONS.has(action)) return true;

  const content = String(input.content ?? "").trim();
  if (content && isRoutineImplementationStatusChatContent(content)) return true;

  const prev = input.previous;
  if (prev && action && prev.action === action) {
    const sameTask =
      String(prev.taskId ?? "") === String(input.taskId ?? "") &&
      String(prev.codeTaskId ?? "") === String(input.codeTaskId ?? "");
    const sameReason = String(prev.reason ?? "") === String(input.reason ?? "");
    if (sameTask && sameReason) return true;
  }
  return false;
}

export function buildImplementationStatusToastDedupeKey(content: string): string {
  const text = String(content ?? "").trim();
  if (!text) return "";
  if (/GitHub commit 확인 (완료|실패)/.test(text)) return "toast:github_commit_verify";
  if (/검수 자동 점검이 완료/.test(text)) return "toast:auto_gate_passed";
  if (/다음 CodeTask\(/.test(text)) return "toast:quick_run_continue";
  return text.slice(0, 120);
}

export function shouldShowImplementationStatusBoardNotice(content: string): boolean {
  return !isRoutineImplementationStatusChatContent(content);
}
