import {
  resolveGithubVerifyStuckEscalation,
  type GithubVerifyStuckEscalation,
} from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";
import type { TaskCursorGithubVerifyDetailReason } from "@/lib/prototype/taskCursorGithubVerify";
import {
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
  type TaskCursorFailureReason,
} from "@/lib/prototype/taskCursorExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ApplyGithubVerifyEscalationResult = Readonly<{
  readonly execution: TaskCursorExecutionV1;
  readonly escalation: GithubVerifyStuckEscalation;
  readonly timelineEntry?: RequirementsPromptTimelineEntry;
}>;

function failureReasonForEscalation(
  escalation: Exclude<GithubVerifyStuckEscalation, "none">,
): TaskCursorFailureReason {
  return escalation === "github_branch_missing" ? "github_branch_missing" : "github_verify_timeout";
}

export function applyGithubVerifyStuckEscalationIfNeeded(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly verifyDetailReason?: TaskCursorGithubVerifyDetailReason | null;
  readonly codeTaskId?: string | null;
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly run?: CodeTaskExecutionRunV1 | null;
  readonly dbRun?: ImplementationRuntimeRunView | null;
  readonly nowIso?: string;
}): ApplyGithubVerifyEscalationResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const escalation = resolveGithubVerifyStuckEscalation({
    execution: input.execution,
    verifyDetailReason: input.verifyDetailReason,
    quickRun: input.quickRun,
    run: input.run,
    dbRun: input.dbRun,
    nowMs: Date.parse(nowIso),
  });

  if (escalation === "none") {
    return { execution: input.execution, escalation: "none" };
  }

  const failureReason = failureReasonForEscalation(escalation);
  const execution = patchTaskCursorExecution(input.execution, {
    status: "github_verify_failed",
    failureReason,
    errorMessage: TASK_CURSOR_FAILURE_MESSAGES[failureReason],
    nowIso,
  });

  const elapsedMs = Date.now() - Date.parse(input.execution.createdAt ?? nowIso);
  const timelineEntry =
    escalation === "github_verify_timeout"
      ? buildImplementationExecutionLogTimelineEntry({
          action: "task_cursor_github_verify_timeout",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: input.execution.projectId,
            taskId: input.execution.taskId,
            codeTaskId: String(input.codeTaskId ?? "").trim() || undefined,
            workBranch: input.execution.workBranch,
            elapsedMs,
            retryable: true,
          },
          nowIso,
        })
      : undefined;

  return { execution, escalation, timelineEntry };
}

export function mapGithubVerifyFailureReasonCode(
  failureReason: TaskCursorFailureReason | undefined,
): string | null {
  if (failureReason === "github_verify_timeout") return "github_verify_timeout";
  if (failureReason === "github_branch_missing") return "github_branch_missing";
  if (failureReason === "github_verify_state_sync_failed") return "github_verify_state_sync_failed";
  return null;
}
