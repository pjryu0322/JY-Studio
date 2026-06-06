import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasTerminalGithubOutcome, runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { isRetryableGithubVerifyFailureReason } from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";

function completedRunBlocksStaleCursor(input: {
  readonly completedTaskId: string;
  readonly completedCodeTaskId?: string | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): boolean {
  const codeTaskId = String(input.completedCodeTaskId ?? "").trim();
  if (!codeTaskId || !input.runs?.length) return false;
  const run = findLatestRunForCodeTask(input.runs, codeTaskId);
  if (!run || run.processTaskId.trim() !== input.completedTaskId.trim()) return false;
  return runHasTerminalGithubOutcome(run);
}

export function hasAutoQualityGatePassedForTask(input: {
  readonly taskId: string;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
}): boolean {
  const taskId = input.taskId.trim();
  if (!taskId) return false;
  const gate = input.autoGate;
  if (gate?.status === "passed" && gate.taskId.trim() === taskId) return true;
  const timeline = input.promptTimeline ?? [];
  return timeline.some((entry) => {
    if (entry.action !== "implementation_auto_quality_gate_passed") return false;
    const fields = entry.fields as Record<string, unknown> | undefined;
    const id = String(fields?.taskId ?? fields?.completedTaskId ?? "").trim();
    return id === taskId;
  });
}

/** completed/passed Task의 stale in-flight가 다음 Quick Run dispatch를 막지 않도록 한다. */
export function shouldBlockQuickRunDispatchForInFlightTaskCursor(input: {
  readonly taskCursor: TaskCursorExecutionV1 | null | undefined;
  readonly nextParentTaskId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId?: string | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
}): boolean {
  const cursor = input.taskCursor;
  if (!cursor || !isInFlightTaskCursorExecution(cursor)) return false;

  const completedId = input.completedTaskId.trim();
  const nextParent = input.nextParentTaskId.trim();

  if (
    completedRunBlocksStaleCursor({
      completedTaskId: completedId,
      completedCodeTaskId: input.completedCodeTaskId,
      runs: input.runs,
    }) &&
    cursor.taskId.trim() === completedId
  ) {
    return false;
  }

  if (
    completedId &&
    cursor.taskId.trim() === completedId &&
    runHasVerifiedGithubOutcome(
      findLatestRunForCodeTask(input.runs, String(input.completedCodeTaskId ?? "").trim()),
    )
  ) {
    return false;
  }

  if (
    completedId &&
    cursor.taskId.trim() === completedId &&
    hasAutoQualityGatePassedForTask({
      taskId: completedId,
      autoGate: input.autoGate,
      promptTimeline: input.promptTimeline,
    })
  ) {
    return false;
  }

  if (cursor.taskId.trim() === nextParent.trim()) {
    return true;
  }

  if (cursor.taskId.trim() !== nextParent.trim() && cursor.taskId.trim() === completedId) {
    if (
      hasAutoQualityGatePassedForTask({
        taskId: completedId,
        autoGate: input.autoGate,
        promptTimeline: input.promptTimeline,
      })
    ) {
      return false;
    }
  }

  if (
    cursor.status === "github_verify_failed" &&
    isRetryableGithubVerifyFailureReason(cursor.failureReason)
  ) {
    return cursor.taskId.trim() === nextParent.trim();
  }

  return cursor.taskId.trim() !== nextParent.trim();
}

export function buildTaskCursorInflightRepairedTimelineFields(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly priorStatus: string;
  readonly reason: string;
}): Record<string, unknown> {
  return {
    projectId: input.projectId,
    taskId: input.taskId,
    priorStatus: input.priorStatus,
    reason: input.reason,
  };
}

export function resolveStaleTaskCursorAfterQualityGatePassed(input: {
  readonly taskCursor: TaskCursorExecutionV1;
  readonly completedTaskId: string;
  readonly autoGateRaw?: unknown;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 | null {
  const autoGate = parseImplementationAutoQualityGateV1(input.autoGateRaw);
  if (
    !hasAutoQualityGatePassedForTask({
      taskId: input.completedTaskId,
      autoGate,
      promptTimeline: input.promptTimeline,
    })
  ) {
    return null;
  }
  if (input.taskCursor.taskId.trim() !== input.completedTaskId.trim()) return null;
  if (!isInFlightTaskCursorExecution(input.taskCursor)) return null;

  const now = input.nowIso ?? new Date().toISOString();
  return {
    ...input.taskCursor,
    status: "review_pending",
    failureReason: undefined,
    errorMessage: undefined,
    githubProgressLastCheckAt: undefined,
    updatedAt: now,
  };
}
