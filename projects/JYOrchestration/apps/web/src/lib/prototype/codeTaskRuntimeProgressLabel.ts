import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import {
  isTaskCursorLongRunningWithoutTerminal,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { resolveTaskCursorGithubVerifyProgressLabelKo } from "@/lib/prototype/taskCursorGithubVerifyView";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export function resolveCodeTaskRuntimeProgressLabelKo(input: {
  readonly dbQueueStatus?: string | null;
  readonly runtimeState?: RuntimeState | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly serverJob?: TaskCursorJobSummary | null;
  readonly githubBranchDetected?: boolean;
  readonly latestRun?: CodeTaskExecutionRunV1 | null;
}): string | null {
  const runOutcome = input.latestRun
    ? normalizeCodeTaskGithubOutcomeFromRun(input.latestRun)
    : null;
  if (runOutcome?.status === "verified") {
    return "GitHub commit 확인 완료";
  }

  const queue = String(input.dbQueueStatus ?? "").trim().toLowerCase();
  const runtime = input.runtimeState ?? null;
  const execution = input.taskCursorExecution;

  const inFlightQueue =
    queue === "dispatching" ||
    queue === "cursor_running" ||
    queue === "cursor_requested" ||
    queue === "github_verifying";
  const inFlightRuntime =
    runtime === "dispatching" ||
    runtime === "cursor_running" ||
    runtime === "github_verifying";

  if (inFlightQueue || inFlightRuntime) {
    if (runtime === "dispatching" || queue === "dispatching") {
      return "AI 개발자 요청 반영 중";
    }
    if (runtime === "github_verifying" || queue === "github_verifying") {
      const phaseLabel = resolveTaskCursorGithubVerifyProgressLabelKo({
        execution: execution ?? undefined,
        run: input.latestRun ?? undefined,
      });
      return phaseLabel;
    }
    if (execution?.status === "github_verifying") {
      return resolveTaskCursorGithubVerifyProgressLabelKo({
        execution,
        run: input.latestRun ?? undefined,
      });
    }
    if (execution?.failureReason === "github_verify_state_sync_failed") {
      return "GitHub 상태 반영 실패";
    }
    const branch = String(execution?.workBranch ?? input.serverJob?.workBranch ?? "").trim();
    if (branch && input.githubBranchDetected) {
      return "GitHub 작업 브랜치 확인됨 · commit 검증 중";
    }
    if (branch) {
      return "AI 개발자 작업 중 · GitHub branch 대기";
    }
    if (execution && isTaskCursorLongRunningWithoutTerminal({ execution })) {
      return "AI 개발자 작업이 오래 걸리고 있습니다 · GitHub 결과를 계속 확인 중";
    }
    return "AI 개발자 작업 중";
  }

  if (queue === "completed" || runtime === "completed") {
    return "CodeTask 완료 · 다음 작업 준비 중";
  }
  if (queue === "rework_required") {
    return "재작업 필요 · GitHub 검증 실패";
  }

  if (isServerTaskCursorPolling() && input.serverJob?.status === "cursor_running") {
    return "AI 개발자 작업 중";
  }

  return null;
}

/** job summary가 queued인데 실제 in-flight이면 '다음 CodeTask 대기'를 숨긴다. */
export function shouldSuppressQueuedSummaryWhileInFlight(input: {
  readonly runtimeState?: RuntimeState | null;
  readonly dbQueueStatus?: string | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
}): boolean {
  const progress = resolveCodeTaskRuntimeProgressLabelKo({
    dbQueueStatus: input.dbQueueStatus,
    runtimeState: input.runtimeState,
    taskCursorExecution: input.taskCursorExecution,
  });
  return progress != null && input.runtimeState === "queued";
}
