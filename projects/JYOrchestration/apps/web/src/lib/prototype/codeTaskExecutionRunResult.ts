import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isTaskCursorStatusCheckStopped } from "@/lib/prototype/taskCursorClientPollLoop";
import type { CodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRun";

export type ClassifiedCodeTaskExecutionRunResult = Readonly<{
  readonly status: CodeTaskExecutionRunStatus;
  readonly branchHeadCommitSha?: string;
  readonly noCodeChangeEvidence?: string;
  readonly failureReason?: string;
  readonly errorMessage?: string;
}>;

function readNoCodeChangeEvidence(execution: TaskCursorExecutionV1): string | undefined {
  const raw = execution as TaskCursorExecutionV1 & {
    noCodeChangeEvidence?: { validationSummary?: string; reason?: string };
    pullRequestUrl?: string;
    pullRequestNumber?: number;
  };
  const evidence = raw.noCodeChangeEvidence;
  if (evidence && typeof evidence === "object") {
    const summary = String(
      (evidence as { validationSummary?: string; reason?: string }).validationSummary ??
        (evidence as { reason?: string }).reason ??
        "",
    ).trim();
    if (summary) return summary;
  }
  return undefined;
}

function hasGithubSuccessEvidence(execution: TaskCursorExecutionV1): boolean {
  const commitSha = String(execution.commitSha ?? execution.branchHeadCommitSha ?? "").trim();
  if (commitSha) return true;
  const raw = execution as TaskCursorExecutionV1 & {
    pullRequestNumber?: number;
    pullRequestUrl?: string;
  };
  if (typeof raw.pullRequestNumber === "number" && raw.pullRequestNumber > 0) return true;
  if (String(raw.pullRequestUrl ?? "").trim()) return true;
  return false;
}

/** Cursor 응답이 아닌 GitHub 증거 기준으로 CodeTask Run terminal status를 분류한다. */
export function classifyCodeTaskExecutionRunFromTaskCursor(
  execution: TaskCursorExecutionV1,
): ClassifiedCodeTaskExecutionRunResult {
  if (isTaskCursorStatusCheckStopped(execution)) {
    return {
      status: "status_check_stopped",
      failureReason: "status_check_stopped",
      errorMessage: execution.errorMessage ?? "상태 확인이 중단되었습니다.",
    };
  }

  const noCodeChangeEvidence = readNoCodeChangeEvidence(execution);

  if (
    execution.status === "github_verified" ||
    execution.status === "review_pending" ||
    execution.status === "security_pending" ||
    execution.status === "scm_pending"
  ) {
    if (hasGithubSuccessEvidence(execution)) {
      return {
        status: "completed",
        branchHeadCommitSha: String(execution.commitSha ?? execution.branchHeadCommitSha ?? "").trim(),
      };
    }
    if (noCodeChangeEvidence) {
      return { status: "no_code_change_completed", noCodeChangeEvidence };
    }
    return {
      status: "rework_required",
      failureReason: "commit_not_created",
      errorMessage: "GitHub commit·PR·변경 없음 증거가 확인되지 않았습니다.",
    };
  }

  if (execution.status === "cursor_completed") {
    if (hasGithubSuccessEvidence(execution)) {
      return {
        status: "completed",
        branchHeadCommitSha: String(execution.commitSha ?? "").trim(),
      };
    }
    if (noCodeChangeEvidence) {
      return { status: "no_code_change_completed", noCodeChangeEvidence };
    }
    return {
      status: "rework_required",
      failureReason: "commit_not_created",
      errorMessage: "Cursor 응답만으로는 완료 처리하지 않습니다.",
    };
  }

  if (execution.failureReason === "prompt_preflight_failed") {
    return {
      status: "failed",
      failureReason: "prompt_preflight_failed",
      errorMessage: execution.errorMessage,
    };
  }

  if (
    execution.status === "cursor_failed" ||
    execution.status === "github_verify_failed"
  ) {
    return {
      status: "failed",
      failureReason: execution.failureReason,
      errorMessage: execution.errorMessage,
    };
  }

  if (execution.status === "github_verifying") {
    return { status: "github_verifying" };
  }

  if (execution.status === "cursor_running" || execution.status === "cursor_requested") {
    return { status: execution.status === "cursor_requested" ? "cursor_requested" : "cursor_running" };
  }

  return { status: "prompt_building" };
}
