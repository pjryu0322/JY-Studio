import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { runHasQualityGatePassed } from "@/lib/prototype/codeTaskQualityOutcome";

/** 선택 큐에서 선행 Task 완료·다음 Task 진행 가능으로 인정하는 terminal success. */
export function isRunSuccessTerminalForSelectedQueueContinuation(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  if (!run) return false;
  if (run.status === "skipped_by_user") return true;
  if (runHasVerifiedGithubOutcome(run)) return true;
  if (runHasQualityGatePassed(run)) return true;
  return false;
}

export function isRunBlockingSelectedQueueContinuation(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  if (!run) return false;
  if (run.status === "failed" || run.status === "rework_required") return true;
  const outcome = run.githubOutcome;
  if (outcome && typeof outcome === "object" && "status" in outcome) {
    if (outcome.status === "failed") {
      const reason = String((outcome as { reason?: string }).reason ?? "");
      if (reason === "github_no_new_commit") return true;
    }
  }
  return false;
}
