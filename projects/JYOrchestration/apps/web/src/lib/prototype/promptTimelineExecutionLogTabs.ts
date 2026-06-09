import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type PromptTimelineDrawerTab = "prompt" | "history" | "execution_log";

const IMPLEMENTATION_TRACE_GROUPS = new Set([
  "task_cursor_execution",
  "implementation_orchestration",
  "target_repo_e2e",
  "platform_scm",
]);

const IMPLEMENTATION_ACTION_PREFIXES = [
  "implementation_",
  "task_cursor_",
  "code_agent_",
  "cursor_api_",
  "platform_scm_",
] as const;

const EXECUTION_LOG_ACTION_LABELS: Record<string, string> = {
  implementation_quick_run_client_blocked: "Quick Run (클라이언트 차단)",
  implementation_quick_run_client_trace: "Quick Run (클라이언트)",
  implementation_ui_toast: "UI 알림",
  implementation_quick_run_started: "Quick 실행 시작",
  implementation_quick_run_cursor_dispatch: "Quick → Cursor 실행 연결",
  quick_run_db_queued_auto_dispatch: "DB queued → Cursor 자동 실행",
  quick_run_next_dispatch_planned: "다음 CodeTask 실행 예정",
  quick_run_next_dispatch_executed: "다음 CodeTask Cursor 실행",
  quick_run_next_dispatch_skipped: "다음 CodeTask 실행 스킵",
  quick_run_continuation_requested: "Quick Run continuation 요청",
  quick_run_next_code_task_resolved: "다음 CodeTask 결정",
  quick_run_next_code_task_blocked: "다음 CodeTask 차단",
  quick_run_next_code_task_dispatch_requested: "다음 CodeTask dispatch 요청",
  quick_run_next_code_task_dispatched: "다음 CodeTask dispatch 완료",
  quick_run_all_selected_code_tasks_completed: "선택 CodeTask 모두 완료",
  quick_run_continuation_noop: "Quick Run continuation 없음",
  quick_run_continuation_patch_persisted: "Quick Run continuation patch 저장",
  quick_run_selected_queue_reconciled: "Quick Run 선택 큐 reconcile",
  quick_run_queued_fallback_dispatch_requested: "queued fallback dispatch 요청",
  quick_run_queued_fallback_dispatch_dispatched: "queued fallback dispatch 완료",
  quick_run_queued_fallback_dispatch_skipped: "queued fallback dispatch 스킵",
  quick_run_queued_fallback_dispatch_failed: "queued fallback dispatch 실패",
  quick_run_queued_target_canonicalized: "queued run CodeTask ID 정규화",
  quick_run_queued_target_tuple_canonicalized: "queued run target tuple 정규화",
  quick_run_queued_target_blocked: "queued run CodeTask ID 차단",
  implementation_code_task_id_repaired: "CodeTask ID 정규화(repair)",
  quick_run_selected_mock_id_blocked: "Quick Run mock ID 차단",
  quick_run_selected_mock_id_repaired: "Quick Run mock ID repair",
  implementation_quick_run_blocked: "자동실행 중단",
  implementation_quick_run_preview_ready: "Preview 준비 완료",
  implementation_auto_quality_gate_requested: "검수·보안 자동 점검 요청",
  implementation_auto_review_started: "검수자 점검 시작",
  implementation_auto_review_passed: "검수자 점검 통과",
  implementation_auto_review_failed: "검수자 점검 실패",
  implementation_auto_security_started: "보안관 점검 시작",
  implementation_auto_security_passed: "보안관 점검 통과",
  implementation_auto_security_failed: "보안관 점검 실패",
  implementation_auto_quality_gate_passed: "검수·보안 자동 점검 통과",
  implementation_auto_quality_gate_failed: "검수·보안 자동 점검 실패",
  implementation_stage_action_routed: "구현 액션 라우팅",
  implementation_stage_action_clicked: "구현 액션 클릭",
  implementation_stage_action_executed: "구현 액션 실행",
  implementation_stage_action_blocked: "구현 액션 차단",
  implementation_intent_routed: "구현 의도 라우팅",
  implementation_action_executed: "구현 액션 실행",
  implementation_action_gate_blocked: "구현 액션 게이트 차단",
  implementation_task_plan: "구현 작업안 생성",
  implementation_work_plan_draft_generated: "작업안 초안 생성",
  implementation_work_plan_draft_confirmed: "작업안 확정",
  implementation_wip_draft_created: "WIP 초안 생성",
  implementation_wip_draft_persisted: "WIP 초안 저장",
  implementation_generation_request_received: "코드 생성 요청 수신",
  implementation_entry_cursor_work_items_regenerated: "Cursor work item 재생성",
  implementation_entry_cursor_work_items_detected: "Cursor work item 감지",
  implementation_work_items_draft_created: "WorkItem 초안 생성",
  implementation_work_item_refined: "WorkItem 소스 기준 보정",
  implementation_work_item_preflight_passed: "WorkItem Preflight 통과",
  implementation_work_item_preflight_failed: "WorkItem Preflight 실패",
  implementation_entry_tasklist_detected: "TaskList 감지",
  implementation_entry_state_snapshot: "구현 진입 상태 스냅샷",
  implementation_selected_queue_reconciled: "선택 CodeTask 큐 reconcile",
  implementation_conflict_precheck_blocked: "통합 사전점검 차단",
  implementation_conflict_precheck_cumulative_overlap_detected: "선형 체인 누적 변경 감지",
  implementation_conflict_precheck_warning: "통합 사전점검 주의",
  implementation_integrated_preview_not_ready: "Integrated Preview 미준비",
  implementation_integration_source_resolved: "통합 source branch 결정",
  implementation_integration_source_resolution_started: "통합 source branch 결정 시작",
  implementation_integration_source_resolution_completed: "통합 source branch 결정 완료",
  implementation_integration_source_resolution_failed: "통합 source branch 결정 실패",
  implementation_plan_arrays_normalized: "통합 plan 배열 정규화",
  integration_pipeline_runtime_error: "통합 파이프라인 런타임 오류",
  implementation_execution_next_unit_resolved: "다음 ExecutionUnit 결정",
  implementation_execution_next_unit_missing_db_run_recreated: "DB run 없음 — ExecutionUnit 기준 재생성",
  implementation_execution_units_built: "ExecutionUnit 생성",
  implementation_execution_units_persisted: "ExecutionUnit 저장",
  implementation_execution_units_bootstrapped_from_legacy: "Legacy → ExecutionUnit bootstrap",
  implementation_execution_unit_started: "ExecutionUnit 실행 시작",
  implementation_execution_unit_verifying: "ExecutionUnit GitHub 검증 중",
  implementation_execution_unit_verified: "ExecutionUnit 검증 완료",
  implementation_execution_unit_failed: "ExecutionUnit 실패",
  implementation_selected_units_persisted: "ExecutionUnit 선택 저장",
  implementation_selected_units_reconciled: "ExecutionUnit 선택 reconcile",
  legacy_selected_code_task_ids_migrated: "CodeTask 선택 → ExecutionUnit 마이그레이션",
  implementation_execution_scheduler_requested: "ExecutionUnit 스케줄러 요청",
  implementation_execution_next_unit_dispatched: "다음 ExecutionUnit dispatch",
  implementation_execution_no_next_unit_complete: "ExecutionUnit 큐 완료",
  implementation_execution_in_flight_noop: "ExecutionUnit in-flight (noop)",
  implementation_execution_completed: "ExecutionUnit 큐 완료",
  implementation_execution_unit_run_history_created: "ExecutionUnit run history 생성",
  implementation_execution_unit_run_history_attached: "ExecutionUnit run history 연결",
  implementation_execution_unit_run_identity_mismatch: "ExecutionUnit run identity 불일치",
  implementation_execution_unit_cursor_launch_requested: "ExecutionUnit Cursor launch 요청",
  implementation_task_cursor_state_changed: "Task Cursor 상태 변경",
  implementation_auto_quality_gate_state_changed: "검수·보안 자동 점검 상태 변경",
  implementation_code_agent_wip_state_changed: "Code Agent WIP 상태 변경",
  implementation_quick_run_state_changed: "Quick 실행 상태 변경",
  implementation_stage_action_run_recorded: "구현 스테이지 액션 실행 기록",
  implementation_task_execution_state_changed: "Task 실행 상태 변경",
  implementation_artifacts_derived: "산출물 파생",
  implementation_artifact_hub_opened: "산출물 허브 열기",
  implementation_artifact_viewed: "산출물 조회",
  implementation_status_query_handled: "구현 상태 조회",
  implementation_user_feedback_applied: "사용자 피드백 반영",
  code_agent_wip_requested: "Code Agent WIP 요청",
  code_agent_wip_draft_created: "WIP 초안 생성",
  code_agent_wip_draft_failed: "WIP 초안 생성 실패",
  cursor_api_direct_execution_requested: "Cursor API 요청",
  cursor_api_direct_execution_started: "Cursor API 실행 시작",
  cursor_api_direct_execution_completed: "Cursor API 완료",
  cursor_api_direct_execution_failed: "Cursor API 실패",
  cursor_api_direct_execution_unsupported: "Cursor API 미지원",
  cursor_api_git_commit_created: "Git 커밋 생성",
  cursor_api_availability_checked: "Cursor API 환경 점검",
  platform_scm_push_requested: "SCM push 요청",
  platform_scm_push_started: "SCM push 시작",
  platform_scm_push_completed: "SCM push 완료",
  platform_scm_push_failed: "SCM push 실패",
  platform_scm_pr_created: "SCM PR 생성",
  platform_scm_pr_requested: "SCM PR 요청",
  platform_scm_pr_failed: "SCM PR 실패",
  platform_scm_merge_requested: "SCM merge 요청",
  platform_scm_merge_completed: "SCM merge 완료",
  platform_scm_merge_failed: "SCM merge 실패",
  task_cursor_execution_requested: "AI 개발자 실행 요청",
  task_cursor_prompt_built: "Cursor prompt 생성",
  task_cursor_api_requested: "Cursor API 요청",
  task_cursor_api_started: "Cursor 작업 진행 중",
  task_cursor_api_completed: "Cursor 작업 완료",
  task_cursor_api_failed: "Cursor 실행 실패",
  task_cursor_github_verify_requested: "GitHub commit 확인 시작",
  task_cursor_github_branch_lookup_retry: "GitHub branch lookup 재시도",
  task_cursor_github_branch_missing_after_retries: "GitHub branch missing (재시도 후)",
  task_cursor_stale_mock_polling_cleared: "stale mock polling 정리",
  task_cursor_github_verified: "GitHub commit 확인 완료",
  task_cursor_github_verify_failed: "GitHub commit 확인 실패",
  task_cursor_auto_chain_started: "Task 자동 연속 실행 시작",
  task_cursor_auto_chain_continued: "Task 자동 연속 실행(다음 작업)",
  task_cursor_auto_chain_continued_after_failure: "실패 후 독립 Task 자동 계속",
  task_cursor_auto_chain_blocked: "Task 자동 연속 실행 차단",
  task_cursor_poll_loop_started: "Cloud Agent 폴링 시작",
  task_cursor_poll_tick: "Cloud Agent 폴링 갱신",
  task_cursor_poll_cancelled: "Cloud Agent 상태 확인 중단",
  task_cursor_poll_resumed: "Cloud Agent 상태 확인 재개",
  task_cursor_poll_timeout: "Cloud Agent 폴링 시간 초과",
};

const PERSISTENT_EXECUTION_LOG_TRACE_GROUPS = new Set([
  "task_cursor_execution",
  "target_repo_e2e",
  "platform_scm",
]);

/** 구현 초기화·타임라인 병합 시에도 유지할 런타임 실행 이력 */
const NON_PERSISTENT_EXECUTION_LOG_ACTIONS = new Set([
  "implementation_bootstrap_lead_developer_summary",
  "implementation_seed_evaluated",
  "planning_implementation_seed_evaluated",
  "implementation_work_plan_draft_generated",
  "implementation_work_plan_draft_confirmed",
  "implementation_intent_routed",
  "implementation_task_plan",
  "implementation_entry_cursor_work_items_regenerated",
  "implementation_entry_cursor_work_items_detected",
  "implementation_entry_tasklist_detected",
  "implementation_slots_built",
]);

function hasImplementationActionPrefix(action: string): boolean {
  return IMPLEMENTATION_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

export function isExecutionLogTimelineEntry(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): boolean {
  if (!entry) return false;
  const action = String(entry.action ?? "").trim();
  if (!action) return false;
  if (entry.stage === "implementation") return true;
  if (entry.workspaceScreenKey === "prototype_execution") return true;
  const traceGroup = String(entry.orchestrationTraceGroup ?? "").trim();
  if (traceGroup && IMPLEMENTATION_TRACE_GROUPS.has(traceGroup)) return true;
  return hasImplementationActionPrefix(action);
}

/** Task Cursor·품질 게이트 등 런타임 실행 이력 — 사용자가 초기화하기 전까지 보존 */
export function isPersistentExecutionLogTimelineEntry(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): boolean {
  if (!entry) return false;
  const action = String(entry.action ?? "").trim();
  if (!action || NON_PERSISTENT_EXECUTION_LOG_ACTIONS.has(action)) return false;
  if (action.startsWith("planning_implementation_seed_")) return false;
  if (action === "implementation_ui_toast") return true;
  if (action.startsWith("quick_run_")) return true;
  if (action.startsWith("task_cursor_")) return true;
  if (action.startsWith("cursor_api_")) return true;
  if (action.startsWith("platform_scm_")) return true;
  const traceGroup = String(entry.orchestrationTraceGroup ?? "").trim();
  if (PERSISTENT_EXECUTION_LOG_TRACE_GROUPS.has(traceGroup)) return true;
  if (
    action.endsWith("_state_changed") ||
    action.startsWith("implementation_auto_quality_gate_") ||
    action.startsWith("implementation_quick_run_") ||
    action.startsWith("implementation_stage_action_") ||
    action === "implementation_entry_state_snapshot"
  ) {
    return true;
  }
  return false;
}

export function pickPersistentExecutionLogTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): readonly RequirementsPromptTimelineEntry[] {
  if (!timeline?.length) return [];
  return [...timeline]
    .filter(isPersistentExecutionLogTimelineEntry)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function pickExecutionLogTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): readonly RequirementsPromptTimelineEntry[] {
  if (!timeline?.length) return [];
  return [...timeline]
    .filter(isExecutionLogTimelineEntry)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function parseExecutionLogResponseFields(
  responseText: string | null | undefined,
): Readonly<Record<string, string>> {
  const text = String(responseText ?? "").trim();
  if (!text) return {};
  const fields: Record<string, string> = {};
  const regex = /(\w+)=((?:[^\s]|(?:\s(?!\w+=)))*)/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    fields[match[1]!] = match[2]!.trim();
    match = regex.exec(text);
  }
  return fields;
}

export function formatExecutionLogTimelineLabel(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): string {
  if (!entry) return "";
  const action = String(entry.action ?? "").trim();
  const fields = parseExecutionLogResponseFields(entry.responseText);
  if (action === "implementation_ui_toast" && fields.message) {
    return fields.message;
  }
  if (action === "implementation_quick_run_client_trace" && fields.message) {
    const phase = fields.phase ? `[${fields.phase}] ` : "";
    return `${phase}${fields.message}`;
  }
  const base = EXECUTION_LOG_ACTION_LABELS[action] ?? action;
  if (action === "task_cursor_api_failed" && fields.reason === "poll_cancelled") {
    return "Cloud Agent 상태 확인 중단(레거시)";
  }
  const taskId = fields.taskId ?? fields.selectedTaskId ?? fields.toTaskId ?? fields.failedTaskId;
  if (taskId && !base.includes(taskId)) {
    return `${base} · ${taskId}`;
  }
  return base;
}

export function formatExecutionLogEntryMetadataLines(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): readonly string[] {
  if (!entry) return [];
  const lines: string[] = [];
  if (entry.source) lines.push(`source: ${entry.source}`);
  if (entry.stage) lines.push(`stage: ${entry.stage}`);
  if (entry.orchestrationTraceGroup) lines.push(`traceGroup: ${entry.orchestrationTraceGroup}`);
  if (entry.routingDecision) lines.push(`routing: ${entry.routingDecision}`);
  if (entry.provider) lines.push(`provider: ${entry.provider}`);
  if (entry.model) lines.push(`model: ${entry.model}`);
  return lines;
}

export function hasExecutionLogTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  return pickExecutionLogTimelineEntries(timeline).length > 0;
}

export function buildExecutionLogEntryCopyText(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): string {
  if (!entry) return "";
  const lines: string[] = [];
  lines.push(formatExecutionLogTimelineLabel(entry));
  lines.push(`createdAt: ${entry.createdAt ?? ""}`);
  if (entry.action) lines.push(`action: ${entry.action}`);
  for (const line of formatExecutionLogEntryMetadataLines(entry)) {
    lines.push(line);
  }
  const fields = parseExecutionLogResponseFields(entry.responseText);
  for (const [key, value] of Object.entries(fields)) {
    if (key === "type") continue;
    lines.push(`${key}: ${value}`);
  }
  if (entry.error?.trim()) lines.push(`error: ${entry.error.trim()}`);
  if (entry.responseText?.trim() && Object.keys(fields).length === 0) {
    lines.push(`responseText: ${entry.responseText.trim()}`);
  }
  if (entry.promptText?.trim()) {
    lines.push("");
    lines.push("--- prompt ---");
    lines.push(entry.promptText.trim());
  }
  return lines.join("\n");
}

export function buildExecutionLogTimelineMarkdown(
  entries: readonly RequirementsPromptTimelineEntry[],
): string {
  const lines: string[] = [];
  lines.push("# 실행 로그");
  lines.push("");
  lines.push(`생성: ${new Date().toISOString()}`);
  lines.push(`항목 수: ${entries.length}`);
  lines.push("");
  entries.forEach((entry, index) => {
    const n = index + 1;
    const label = formatExecutionLogTimelineLabel(entry);
    lines.push(`## ${n}. ${label}`);
    lines.push("");
    lines.push(`- **action**: ${entry.action ?? "—"}`);
    lines.push(`- **createdAt**: ${entry.createdAt ?? "—"}`);
    if (entry.source) lines.push(`- **source**: ${entry.source}`);
    if (entry.stage) lines.push(`- **stage**: ${entry.stage}`);
    if (entry.orchestrationTraceGroup) {
      lines.push(`- **traceGroup**: ${entry.orchestrationTraceGroup}`);
    }
    if (entry.routingDecision) lines.push(`- **routing**: ${entry.routingDecision}`);
    if (entry.provider) lines.push(`- **provider**: ${entry.provider}`);
    if (entry.model) lines.push(`- **model**: ${entry.model}`);
    lines.push("");
    lines.push("```text");
    lines.push(buildExecutionLogEntryCopyText(entry).trim() || "(없음)");
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}
