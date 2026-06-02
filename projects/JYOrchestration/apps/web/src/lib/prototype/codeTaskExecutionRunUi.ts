import type { CodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRun";

const LABELS: Record<CodeTaskExecutionRunStatus, string> = {
  queued: "대기",
  prompt_building: "프롬프트 생성 중",
  cursor_requested: "Cursor 작업 요청 중",
  cursor_running: "Cursor 작업 중",
  github_verifying: "GitHub 결과 확인 중",
  completed: "완료",
  no_code_change_completed: "변경 없음",
  rework_required: "재작업 필요",
  failed: "실패",
};

export function formatCodeTaskExecutionRunStatusKo(
  status: CodeTaskExecutionRunStatus,
): string {
  return LABELS[status] ?? status;
}

export function formatCodeTaskExecutionQueueSummary(input: {
  readonly currentIndex: number;
  readonly total: number;
  readonly status: string;
}): string {
  if (input.total <= 0) return "선택된 CodeTask 없음";
  const pos = Math.min(input.currentIndex + 1, input.total);
  return `선택 CodeTask ${pos}/${input.total} · ${input.status}`;
}
