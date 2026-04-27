/**
 * 프로토타입 파이프라인 컴팩트 로그 (서버 콘솔).
 */

export type PrototypeRunLogEvent =
  | "prototype_run_created"
  | "prototype_cursor_requested"
  | "prototype_commit_detected"
  | "prototype_review_started"
  | "prototype_pr_opened"
  | "prototype_merged"
  | "prototype_preview_ready"
  | "prototype_failed";

export function logPrototypePipelineEvent(
  event: PrototypeRunLogEvent,
  payload: Readonly<Record<string, unknown>>,
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...payload });
  console.info(`[prototype-pipeline] ${line}`);
}
