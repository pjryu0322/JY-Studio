import type { CodeTaskExecutionRunStatus, CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionQueueStatus } from "@/lib/prototype/codeTaskExecutionQueue";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const RUN_LABELS: Record<CodeTaskExecutionRunStatus, string> = {
  queued: "대기",
  prompt_building: "프롬프트 생성 중",
  prompt_ready: "프롬프트 준비됨",
  cursor_requested: "Cursor 작업 요청 중",
  cursor_running: "Cursor 작업 중",
  github_verifying: "GitHub 결과 확인 중",
  completed: "완료",
  no_code_change_completed: "변경 없음",
  rework_required: "재작업 필요",
  status_check_stopped: "상태 확인 중단",
  blocked_by_dependency: "대기",
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

export type CodeTaskExecutionQueueRunBreakdown = Readonly<{
  readonly completed: number;
  readonly noCodeChange: number;
  readonly reworkRequired: number;
  readonly statusCheckStopped: number;
  readonly failed: number;
  readonly issues: number;
}>;

export function summarizeCodeTaskExecutionQueueRuns(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly selectedCodeTaskIds: readonly string[];
}): CodeTaskExecutionQueueRunBreakdown {
  let completed = 0;
  let noCodeChange = 0;
  let reworkRequired = 0;
  let statusCheckStopped = 0;
  let failed = 0;
  for (const codeTaskId of input.selectedCodeTaskIds) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (!run) continue;
    switch (run.status) {
      case "completed":
        completed += 1;
        break;
      case "no_code_change_completed":
        noCodeChange += 1;
        break;
      case "rework_required":
        reworkRequired += 1;
        break;
      case "status_check_stopped":
        statusCheckStopped += 1;
        break;
      case "blocked_by_dependency":
        break;
      case "failed":
        failed += 1;
        break;
      case "github_verified":
        completed += 1;
        break;
      default:
        if (runHasVerifiedGithubOutcome(run)) completed += 1;
        break;
    }
  }
  const issues = reworkRequired + statusCheckStopped + failed;
  return {
    completed,
    noCodeChange,
    reworkRequired,
    statusCheckStopped,
    failed,
    issues,
  };
}

export function formatCodeTaskExecutionQueueSummary(input: {
  readonly currentIndex: number;
  readonly total: number;
  readonly status: string;
  readonly runSummary?: CodeTaskExecutionQueueRunBreakdown;
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
    input.runSummary.reworkRequired ? `재작업 ${input.runSummary.reworkRequired}` : null,
    input.runSummary.statusCheckStopped ? `중단 ${input.runSummary.statusCheckStopped}` : null,
    input.runSummary.failed ? `실패 ${input.runSummary.failed}` : null,
  ].filter(Boolean);
  return parts.length ? `${base} · ${parts.join(" · ")}` : base;
}

export function formatCodeTaskExecutionQueueCompletionDetail(input: {
  readonly runSummary: CodeTaskExecutionQueueRunBreakdown;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly selectedCodeTaskIds: readonly string[];
}): string {
  const lines = ["선택 CodeTask 실행 완료"];
  const counts = [
    input.runSummary.completed ? `- 완료: ${input.runSummary.completed}개` : null,
    input.runSummary.noCodeChange ? `- 변경 없음: ${input.runSummary.noCodeChange}개` : null,
    input.runSummary.reworkRequired ? `- 재작업 필요: ${input.runSummary.reworkRequired}개` : null,
    input.runSummary.statusCheckStopped ? `- 상태 확인 중단: ${input.runSummary.statusCheckStopped}개` : null,
    input.runSummary.failed ? `- 실패: ${input.runSummary.failed}개` : null,
  ].filter(Boolean);
  lines.push(...counts);
  const issueIds = input.selectedCodeTaskIds.filter((codeTaskId) => {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    return (
      run &&
      (run.status === "rework_required" ||
        run.status === "status_check_stopped" ||
        run.status === "failed")
    );
  });
  for (const codeTaskId of issueIds.slice(0, 5)) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    const title =
      input.codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId)?.title ?? codeTaskId;
    const label = run ? formatCodeTaskExecutionRunStatusKo(run.status) : "이슈";
    lines.push(`- ${codeTaskId} · ${title} (${label})`);
  }
  return lines.join("\n");
}
