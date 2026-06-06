import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasTerminalGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

/** P3-M41: taskCursorExecutionV1의 Cursor API 세션 역할 (완료 판정 없음) */
export type CursorSessionStatus = "requested" | "running" | "api_failed" | "closed";

export type CursorSession = Readonly<{
  readonly sessionId: string;
  readonly runId?: string | null;
  readonly processTaskId: string;
  readonly cursorJobId?: string | null;
  readonly status: CursorSessionStatus;
  readonly lastPollAt?: string | null;
  readonly lastMessage?: string | null;
  readonly legacyStatus?: TaskCursorExecutionV1["status"];
}>;

export function mapTaskCursorExecutionToCursorSession(
  execution: TaskCursorExecutionV1 | null | undefined,
): CursorSession | null {
  if (!execution) return null;
  const legacy = execution.status;
  let status: CursorSessionStatus = "closed";
  if (legacy === "cursor_requested") status = "requested";
  else if (legacy === "cursor_running" || legacy === "github_verifying" || legacy === "cursor_completed") {
    status = "running";
  } else if (legacy === "cursor_failed" || legacy === "github_verify_failed") {
    status = "api_failed";
  }
  return {
    sessionId: `${execution.projectId}:${execution.taskId}:${execution.updatedAt}`,
    runId: execution.cursorRunId ?? null,
    processTaskId: execution.taskId,
    cursorJobId: execution.cursorRunId ?? null,
    status,
    lastPollAt: execution.githubProgressLastCheckAt ?? execution.updatedAt,
    lastMessage: execution.errorMessage ?? null,
    legacyStatus: legacy,
  };
}

export function isCursorSessionStaleForRun(input: {
  readonly session: CursorSession | null | undefined;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
}): boolean {
  const session = input.session;
  const run = input.run;
  if (!session || !run) return false;
  if (!runHasTerminalGithubOutcome(run)) return false;
  const legacy = session.legacyStatus;
  return legacy === "github_verifying" || legacy === "cursor_completed";
}

export function resolveCursorSessionForRunPhase(
  execution: TaskCursorExecutionV1 | null | undefined,
  run: CodeTaskExecutionRunV1 | null | undefined,
): TaskCursorExecutionV1 | null {
  if (!execution) return null;
  const session = mapTaskCursorExecutionToCursorSession(execution);
  if (isCursorSessionStaleForRun({ session, run })) return null;
  return execution;
}
