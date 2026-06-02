import type { CodeTaskExecutionRunStatus, CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionQueueStatus } from "@/lib/prototype/codeTaskExecutionQueue";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import { isQueueIssueRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";

const RUN_LABELS: Record<CodeTaskExecutionRunStatus, string> = {
  queued: "대기",
  prompt_building: "프롬프트 생성 중",
  cursor_requested: "Cursor 작업 요청 중",
  cursor_running: "Cursor 작업 중",
  github_verifying: "GitHub 결과 확인 중",
  completed: "완료",
  no_code_change_completed: "변경 없음",
  rework_required: "재작업 필요",
  status_check_stopped: "상태 확인 중단",
  failed: "실패",
};

const QUEUE_STATUS_LABELS: Record<CodeTaskExecutionQueueStatus, string> = {
  idle: "대기",
  running: "실행 중",
  paused: "일시 중지",
  completed: "완료",
  completed_with_issues: "완료(일부 이슈)",
  failed: "중단됨",
};

export function formatCodeTaskExecutionRunStatusKo(
  status: CodeTaskExecutionRunStatus,
): string {
  return RUN_LABELS[status] ?? status;
}

export function formatCodeTaskExecutionQueueStatusKo(status: string): string {
  return QUEUE_STATUS_LABELS[status as CodeTaskExecutionQueueStatus] ?? status;
}

export function summarizeCodeTaskExecutionQueueRuns(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly selectedCodeTaskIds: readonly string[];
}): Readonly<{
  readonly completed: number;
  readonly noCodeChange: number;
  readonly issues: number;
}> {
  let completed = 0;
  let noCodeChange = 0;
  let issues = 0;
  for (const codeTaskId of input.selectedCodeTaskIds) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (!run) continue;
    if (run.status === "completed") completed += 1;
    else if (run.status === "no_code_change_completed") noCodeChange += 1;
    else if (isQueueIssueRunStatus(run.status)) issues += 1;
  }
  return { completed, noCodeChange, issues };
}

export function formatCodeTaskExecutionQueueSummary(input: {
  readonly currentIndex: number;
  readonly total: number;
  readonly status: string;
  readonly runSummary?: ReturnType<typeof summarizeCodeTaskExecutionQueueRuns>;
}): string {
  if (input.total <= 0) return "선택된 CodeTask 없음";
  const pos = Math.min(input.currentIndex + 1, input.total);
  const statusLabel = formatCodeTaskExecutionQueueStatusKo(input.status);
  const base = `선택 CodeTask ${pos}/${input.total} · ${statusLabel}`;
  if (!input.runSummary || input.status === "running" || input.status === "idle") {
    return base;
  }
  const parts = [
    input.runSummary.completed ? `완료 ${input.runSummary.completed}` : null,
    input.runSummary.noCodeChange ? `변경 없음 ${input.runSummary.noCodeChange}` : null,
    input.runSummary.issues ? `이슈 ${input.runSummary.issues}` : null,
  ].filter(Boolean);
  return parts.length ? `${base} · ${parts.join(" · ")}` : base;
}
