import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isTaskCursorStatusCheckStopped } from "@/lib/prototype/taskCursorClientPollLoop";
import type {
  ImplementationExecutionJobStatus,
} from "@/lib/prototype/implementationExecutionJob";

export type ClassifiedImplementationExecutionJobResult = Readonly<{
  readonly status: ImplementationExecutionJobStatus;
  readonly branchHeadCommitSha?: string;
  readonly noCodeChangeEvidence?: string;
  readonly failureReason?: string;
  readonly errorMessage?: string;
}>;

function formatNoCodeChangeEvidence(execution: TaskCursorExecutionV1): string | undefined {
  const raw = execution as TaskCursorExecutionV1 & {
    noCodeChangeEvidence?: { validationSummary?: string; reason?: string };
  };
  const evidence = raw.noCodeChangeEvidence;
  if (!evidence) return undefined;
  const summary = String(evidence.validationSummary ?? evidence.reason ?? "").trim();
  return summary || undefined;
}

/** GitHub commit / no-code-change evidence 기준으로 Job terminal status를 분류한다. */
export function classifyImplementationExecutionJobFromTaskCursor(
  execution: TaskCursorExecutionV1,
): ClassifiedImplementationExecutionJobResult {
  if (isTaskCursorStatusCheckStopped(execution)) {
    return {
      status: "status_check_stopped",
      errorMessage: execution.errorMessage,
      failureReason: execution.failureReason,
    };
  }

  const commitSha = String(
    execution.commitSha ?? execution.branchHeadCommitSha ?? "",
  ).trim();
  const noCodeChangeEvidence = formatNoCodeChangeEvidence(execution);

  if (
    execution.status === "github_verified" ||
    execution.status === "review_pending" ||
    execution.status === "security_pending" ||
    execution.status === "scm_pending"
  ) {
    if (commitSha) {
      return {
        status: "completed",
        branchHeadCommitSha: commitSha,
      };
    }
    if (noCodeChangeEvidence) {
      return {
        status: "no_code_change_completed",
        noCodeChangeEvidence,
      };
    }
    return {
      status: "rework_required",
      failureReason: "commit_not_created",
      errorMessage: "GitHub commit 또는 변경 없음 증거가 확인되지 않았습니다.",
    };
  }

  if (execution.status === "cursor_completed") {
    if (commitSha) {
      return { status: "completed", branchHeadCommitSha: commitSha };
    }
    if (noCodeChangeEvidence) {
      return { status: "no_code_change_completed", noCodeChangeEvidence };
    }
    return {
      status: "rework_required",
      failureReason: "commit_not_created",
      errorMessage: "Cursor 응답만으로는 완료로 처리하지 않습니다. commit 또는 noCodeChangeEvidence가 필요합니다.",
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

  return { status: "running" };
}
