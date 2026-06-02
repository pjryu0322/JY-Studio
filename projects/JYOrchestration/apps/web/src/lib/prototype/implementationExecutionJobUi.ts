import type { ImplementationExecutionJobStatus } from "@/lib/prototype/implementationExecutionJob";

const JOB_STATUS_LABEL_KO: Record<ImplementationExecutionJobStatus, string> = {
  queued: "대기",
  running: "실행 중",
  github_verifying: "GitHub 확인 중",
  completed: "완료",
  no_code_change_completed: "변경 없음",
  rework_required: "재작업 필요",
  blocked_by_dependency: "차단",
  status_check_stopped: "상태 확인 중단",
  timeout: "실패",
  failed: "실패",
};

export function formatImplementationExecutionJobStatusKo(
  status: ImplementationExecutionJobStatus,
): string {
  return JOB_STATUS_LABEL_KO[status] ?? status;
}
