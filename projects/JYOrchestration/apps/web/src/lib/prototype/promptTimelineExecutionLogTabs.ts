import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { RELEVANT_TIMELINE_ACTIONS } from "@/lib/prototype/codeAgentExecutionProgressView";

export type PromptTimelineDrawerTab = "prompt" | "history" | "execution_log";

const QUICK_RUN_TIMELINE_ACTIONS = new Set([
  "implementation_quick_run_started",
  "implementation_quick_run_blocked",
  "implementation_quick_run_preview_ready",
]);

const EXECUTION_LOG_TIMELINE_ACTIONS = new Set<string>([
  ...RELEVANT_TIMELINE_ACTIONS,
  ...QUICK_RUN_TIMELINE_ACTIONS,
  "implementation_auto_quality_gate_requested",
  "implementation_auto_review_started",
  "implementation_auto_review_passed",
  "implementation_auto_review_failed",
  "implementation_auto_security_started",
  "implementation_auto_security_passed",
  "implementation_auto_security_failed",
  "implementation_auto_quality_gate_passed",
  "implementation_auto_quality_gate_failed",
]);

const EXECUTION_LOG_ACTION_LABELS: Record<string, string> = {
  implementation_quick_run_started: "Quick 실행 시작",
  implementation_quick_run_blocked: "자동실행 중단",
  implementation_quick_run_preview_ready: "Preview 준비 완료",
  implementation_auto_quality_gate_started: "검수자·보안관 점검 시작",
  implementation_auto_quality_gate_completed: "검수자·보안관 점검 완료",
  implementation_auto_quality_gate_failed: "검수자·보안관 점검 실패",
  task_cursor_execution_requested: "AI 개발자 실행 요청",
  task_cursor_prompt_built: "Task 선택",
  task_cursor_api_requested: "Cursor API 요청",
  task_cursor_api_started: "Cursor 작업 진행 중",
  task_cursor_api_completed: "Cursor 작업 완료",
  task_cursor_api_failed: "Cursor 실행 실패",
  task_cursor_github_verify_requested: "GitHub commit 확인 시작",
  task_cursor_github_verified: "GitHub commit 확인 완료",
  task_cursor_github_verify_failed: "GitHub commit 확인 실패",
};

export function isExecutionLogTimelineEntry(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): boolean {
  if (!entry) return false;
  const action = String(entry.action ?? "").trim();
  if (!action) return false;
  if (EXECUTION_LOG_TIMELINE_ACTIONS.has(action)) return true;
  return entry.stage === "implementation" && action.startsWith("task_cursor_");
}

export function pickExecutionLogTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): readonly RequirementsPromptTimelineEntry[] {
  if (!timeline?.length) return [];
  return [...timeline]
    .filter(isExecutionLogTimelineEntry)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function formatExecutionLogTimelineLabel(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): string {
  if (!entry) return "";
  const action = String(entry.action ?? "").trim();
  return EXECUTION_LOG_ACTION_LABELS[action] ?? action;
}

export function hasExecutionLogTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  return pickExecutionLogTimelineEntries(timeline).length > 0;
}
