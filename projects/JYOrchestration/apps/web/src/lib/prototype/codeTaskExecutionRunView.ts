import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { formatCodeTaskExecutionRunStatusKo } from "@/lib/prototype/codeTaskExecutionRunUi";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";

export const CODE_TASK_IN_FLIGHT_USER_MESSAGE =
  "현재 선택한 CodeTask 작업이 진행 중입니다. 완료 후 다음 CodeTask를 실행할 수 있습니다." as const;

export type CodeTaskRunUserStatusTone = "idle" | "running" | "success" | "warning" | "danger";

export function buildCodeTaskRunUserStatus(
  run: CodeTaskExecutionRunV1 | null | undefined,
): Readonly<{
  readonly label: string;
  readonly detail: string;
  readonly tone: CodeTaskRunUserStatusTone;
}> {
  if (!run) {
    return { label: "대기", detail: "실행 대기 중입니다.", tone: "idle" };
  }
  const label = formatCodeTaskExecutionRunStatusKo(run.status);
  if (isInFlightCodeTaskExecutionRunStatus(run.status)) {
    const detail =
      run.status === "github_verifying"
        ? "GitHub 결과를 확인하는 중입니다."
        : run.status === "cursor_requested"
          ? "Cursor에 작업을 요청하는 중입니다."
          : "Cursor 작업을 진행하는 중입니다.";
    return { label, detail, tone: "running" };
  }
  switch (run.status) {
    case "completed":
      return { label, detail: "GitHub 결과 확인이 완료되었습니다.", tone: "success" };
    case "no_code_change_completed":
      return { label, detail: "코드 변경 없이 완료되었습니다.", tone: "success" };
    case "rework_required":
      return {
        label,
        detail: run.errorMessage ?? "GitHub commit·PR·변경 없음 증거가 필요합니다.",
        tone: "warning",
      };
    case "status_check_stopped":
      return {
        label,
        detail: run.errorMessage ?? "상태 확인이 중단되었습니다. [상태 확인]으로 재개할 수 있습니다.",
        tone: "warning",
      };
    case "blocked_by_dependency":
      return {
        label,
        detail: run.errorMessage ?? "선행 CodeTask가 완료되지 않아 실행하지 않았습니다.",
        tone: "warning",
      };
    case "failed":
      return {
        label,
        detail: run.errorMessage ?? "실행에 실패했습니다.",
        tone: "danger",
      };
    default:
      return { label, detail: "", tone: "idle" };
  }
}

export function buildCodeTaskRunGithubEvidenceSummary(
  run: CodeTaskExecutionRunV1 | null | undefined,
): Readonly<{
  readonly branch?: string;
  readonly pr?: string;
  readonly commit?: string;
  readonly changedFileCount?: number;
  readonly noCodeChange?: string;
}> {
  if (!run) return {};
  const commit = String(run.commitSha ?? run.branchHeadCommitSha ?? "").trim();
  const pr =
    typeof run.pullRequestNumber === "number" && run.pullRequestNumber > 0
      ? `#${run.pullRequestNumber}`
      : run.pullRequestUrl?.trim() || undefined;
  return {
    ...(run.workBranch?.trim() ? { branch: run.workBranch.trim() } : {}),
    ...(pr ? { pr } : {}),
    ...(commit ? { commit } : {}),
    ...(run.changedFiles?.length ? { changedFileCount: run.changedFiles.length } : {}),
    ...(run.noCodeChangeEvidence?.trim() ? { noCodeChange: run.noCodeChangeEvidence.trim() } : {}),
  };
}

export function buildCodeTaskStatusCheckUserMessage(input: {
  readonly codeTaskTitle?: string | null;
  readonly codeTaskId?: string | null;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
  readonly elapsedMinutes?: number | null;
}): string {
  const title =
    String(input.codeTaskTitle ?? "").trim() ||
    String(input.codeTaskId ?? input.run?.codeTaskId ?? "").trim() ||
    "CodeTask";
  const userStatus = buildCodeTaskRunUserStatus(input.run);
  const github = buildCodeTaskRunGithubEvidenceSummary(input.run);
  const lines = [`CodeTask: ${title}`, `상태: ${userStatus.label}`];
  if (userStatus.detail) lines.push(`진행: ${userStatus.detail}`);
  if (input.elapsedMinutes != null && input.elapsedMinutes > 0) {
    lines.push(`경과: ${input.elapsedMinutes}분`);
  }
  const githubParts = [
    github.pr ? `PR ${github.pr}` : null,
    github.commit ? `commit ${github.commit}` : null,
    github.branch ? `branch ${github.branch}` : null,
    github.noCodeChange ? "변경 없음 확인" : null,
  ].filter(Boolean);
  if (githubParts.length) {
    lines.push(`GitHub: ${githubParts.join(" / ")}`);
  } else if (isInFlightCodeTaskExecutionRunStatus(input.run?.status ?? "queued")) {
    lines.push("GitHub: 결과 대기 중");
  }
  return lines.join("\n");
}

export function buildCodeTaskRunLaunchToastMessage(input: {
  readonly codeTaskId: string;
  readonly codeTaskTitle?: string | null;
}): string {
  const title = String(input.codeTaskTitle ?? "").trim() || input.codeTaskId;
  return `CodeTask 실행 시작 · ${title}`;
}
