import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  TASK_CURSOR_GITHUB_INITIAL_WAIT_MS,
  TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS = TASK_CURSOR_GITHUB_INITIAL_WAIT_MS;
export const CODE_TASK_GITHUB_POLL_INTERVAL_MS = TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS;

export function resolveFirstGithubPollAt(dispatchedAt: Date): Date {
  return new Date(dispatchedAt.getTime() + CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS);
}

export type ImplementationExecutionUnitGithubPollTimelineAction =
  | "implementation_execution_unit_github_poll_scheduled"
  | "implementation_execution_unit_github_poll_waiting"
  | "implementation_execution_unit_github_poll_started"
  | "implementation_execution_unit_github_branch_lookup_requested"
  | "implementation_execution_unit_github_branch_missing_retry_scheduled"
  | "implementation_execution_unit_github_head_commit_resolved"
  | "implementation_execution_unit_github_verify_passed"
  | "implementation_execution_unit_github_verify_timeout"
  | "implementation_execution_unit_github_verify_failed";

export function buildImplementationExecutionUnitGithubPollTimelineEntry(input: {
  readonly action: ImplementationExecutionUnitGithubPollTimelineAction;
  readonly projectId: string;
  readonly unitId?: string | null;
  readonly codeTaskId: string;
  readonly processTaskId?: string | null;
  readonly targetRepository?: string | null;
  readonly baseBranch?: string | null;
  readonly workBranch?: string | null;
  readonly pollAttempt?: number;
  readonly firstPollDelayMs?: number;
  readonly pollIntervalMs?: number;
  readonly elapsedMs?: number;
  readonly branchHeadCommit?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      unitId: input.unitId ?? undefined,
      codeTaskId: input.codeTaskId,
      processTaskId: input.processTaskId ?? undefined,
      targetRepository: input.targetRepository ?? undefined,
      baseBranch: input.baseBranch ?? undefined,
      workBranch: input.workBranch ?? undefined,
      pollAttempt: input.pollAttempt,
      firstPollDelayMs: input.firstPollDelayMs ?? CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
      pollIntervalMs: input.pollIntervalMs ?? CODE_TASK_GITHUB_POLL_INTERVAL_MS,
      elapsedMs: input.elapsedMs,
      branchHeadCommit: input.branchHeadCommit ?? undefined,
      errorCode: input.errorCode ?? undefined,
      errorMessage: input.errorMessage ?? undefined,
    },
    nowIso: input.nowIso,
  });
}
