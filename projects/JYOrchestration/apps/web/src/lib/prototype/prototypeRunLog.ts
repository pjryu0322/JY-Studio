/**
 * 프로토타입 파이프라인 컴팩트 로그 (서버 콘솔).
 */

export type PrototypeRunLogEvent =
  | "prototype_run_created"
  | "prototype_cursor_requested"
  | "prototype_branch_detected"
  | "prototype_commit_detected"
  | "prototype_push_confirmed"
  | "prototype_review_started"
  | "prototype_review_passed"
  | "prototype_rework_required"
  | "prototype_pr_opened"
  | "prototype_merged"
  | "prototype_preview_ready"
  | "prototype_cancel_requested"
  | "prototype_cursor_cancel_requested"
  | "prototype_cancelled"
  | "prototype_resume_requested"
  | "prototype_resumed"
  | "prototype_restart_requested"
  | "prototype_restarted"
  | "prototype_cleanup_requested"
  | "prototype_failed"
  | "prototype_deploy_security_fix_unit_appended"
  | "prototype_knowledge_pack_context_failed";

export function logPrototypePipelineEvent(
  event: PrototypeRunLogEvent,
  payload: Readonly<Record<string, unknown>>,
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...payload });
  console.info(`[prototype-pipeline] ${line}`);
}
