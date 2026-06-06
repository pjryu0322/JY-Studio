import type { CodeTaskExecutionFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { resolveGithubVerifyStuckEscalation } from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { QUICK_RUN_DISPATCH_REASON } from "@/lib/prototype/quickRunDispatchReasonCodes";

const RECOVERY_PHASES = new Set<CodeTaskExecutionFlowPhase>([
  "github_branch_missing",
  "github_verify_timeout",
  "dispatch_failed_retryable",
]);

export function shouldShowCodeTaskStuckRecoveryPanel(input: {
  readonly flowPhase: CodeTaskExecutionFlowPhase | null | undefined;
  readonly taskCursor?: TaskCursorExecutionV1 | null;
  readonly lastDispatchFailureReason?: string | null;
}): boolean {
  const phase = input.flowPhase;
  if (phase && RECOVERY_PHASES.has(phase)) return true;
  const reason = String(input.lastDispatchFailureReason ?? "").trim();
  if (
    reason === QUICK_RUN_DISPATCH_REASON.execution_record_missing ||
    reason === QUICK_RUN_DISPATCH_REASON.dispatch_failed_retryable
  ) {
    return true;
  }
  if (input.taskCursor?.status === "github_verifying") {
    const escalation = resolveGithubVerifyStuckEscalation({ execution: input.taskCursor });
    return escalation !== "none";
  }
  return false;
}

export function resolveCodeTaskStuckRecoveryHint(input: {
  readonly flowPhase: CodeTaskExecutionFlowPhase | null | undefined;
  readonly workBranch?: string | null;
}): string {
  switch (input.flowPhase) {
    case "github_verify_timeout":
      return "GitHub 작업 branch 또는 commit을 확인하지 못했습니다. Cursor 작업이 push되지 않았거나 branch 생성에 실패했을 수 있습니다.";
    case "github_branch_missing": {
      const branch = String(input.workBranch ?? "").trim();
      return branch
        ? `예상 branch: ${branch}`
        : "GitHub 작업 branch가 아직 생성되지 않았습니다. Cursor 실행 상태를 확인하거나 이 CodeTask를 재실행해 주세요.";
    }
    case "dispatch_failed_retryable":
      return "다음 CodeTask 실행 기록을 생성하지 못했습니다. 재실행하거나 선택 실행을 중단해 주세요.";
    default:
      return "";
  }
}
