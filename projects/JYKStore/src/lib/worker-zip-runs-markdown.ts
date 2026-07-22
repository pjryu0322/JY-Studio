/**
 * Markdown export for Admin "Worker 작업 내역" (current + past runs).
 * Kept outside the client component so unit tests can import it without React.
 */
import type { AdminWorkerZipRunView } from "@/lib/admin-review-api";
import { describeWorkerZipStepLabel, formatDurationMs } from "@/lib/worker-zip-step-labels";

export function buildWorkerZipRunsMarkdown(input: {
  packId: string;
  currentRun: AdminWorkerZipRunView | null;
  pastRuns: AdminWorkerZipRunView[];
  exportedAt?: string;
}): string {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const lines: string[] = [
    `# Worker 작업 내역`,
    ``,
    `- packId: \`${input.packId}\``,
    `- exportedAt: ${exportedAt}`,
    ``,
  ];

  if (input.currentRun) {
    lines.push(`## 현재 작업`);
    lines.push(``);
    lines.push(...formatRunMarkdown(input.currentRun));
    lines.push(``);
  }

  if (input.pastRuns.length > 0) {
    lines.push(`## 과거 작업 내역 (${input.pastRuns.length}건)`);
    lines.push(``);
    input.pastRuns.forEach((run, index) => {
      lines.push(
        `### ${index + 1}. ${runStatusLabel(run.status)} — ${formatDateTime(run.startedAt)}`,
      );
      lines.push(``);
      lines.push(...formatRunMarkdown(run));
      lines.push(``);
    });
  }

  if (!input.currentRun && input.pastRuns.length === 0) {
    lines.push(`(작업 내역 없음)`);
    lines.push(``);
  }

  return lines.join("\n");
}

function formatRunMarkdown(run: AdminWorkerZipRunView): string[] {
  const running = run.status === "RUNNING";
  const lines: string[] = [
    `- runId: \`${run.runId}\``,
    `- 상태: ${runStatusLabel(run.status)}`,
    `- 시작: ${formatDateTime(run.startedAt)}`,
    `- 종료: ${run.finishedAt ? formatDateTime(run.finishedAt) : "-"}`,
    `- 현재 단계: ${run.currentStepLabel || describeWorkerZipStepLabel(run.currentStep) || "-"}`,
    `- 경과 시간: ${
      run.durationMs != null ? formatDurationMs(run.durationMs) : running ? "진행 중" : "-"
    }`,
  ];
  if (run.summary) {
    if (typeof run.summary.excludedFiles === "number") {
      lines.push(`- 제외 파일: ${run.summary.excludedFiles}개`);
    }
    if (typeof run.summary.importedChunkCount === "number") {
      lines.push(`- 검색 청크: ${run.summary.importedChunkCount}개`);
    }
    if (typeof run.summary.importedEmbeddingCount === "number") {
      lines.push(`- 검색데이터: ${run.summary.importedEmbeddingCount}개`);
    }
  }
  if (run.errorMessage) {
    lines.push(`- 오류: ${run.errorMessage}`);
  }
  if (run.stepLogs.length > 0) {
    lines.push(``);
    lines.push(`#### 단계 로그`);
    lines.push(``);
    for (const log of run.stepLogs) {
      const msg = log.message ? ` — ${log.message}` : "";
      lines.push(
        `- ${stepStatusMark(log.status)} ${describeWorkerZipStepLabel(log.step)}${msg} (${formatTime(log.createdAt)})`,
      );
    }
  }
  return lines;
}

function runStatusLabel(status: AdminWorkerZipRunView["status"]): string {
  switch (status) {
    case "RUNNING":
      return "생성 실행 중";
    case "PASS":
      return "생성 완료";
    case "FAIL":
      return "생성 실패";
    case "SKIPPED":
      return "중단됨";
    default:
      return status;
  }
}

function stepStatusMark(status: AdminWorkerZipRunView["stepLogs"][number]["status"]): string {
  switch (status) {
    case "PASS":
      return "✓";
    case "FAIL":
      return "✕";
    case "RUNNING":
      return "…";
    default:
      return "·";
  }
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("ko-KR", { timeStyle: "medium" });
}
