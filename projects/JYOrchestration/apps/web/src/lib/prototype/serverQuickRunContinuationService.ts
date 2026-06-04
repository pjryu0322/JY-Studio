import { checkCodeTaskDependencyReady } from "@/lib/prototype/codeTaskDependencyResolver";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import {
  resolveCompletedCodeTaskId,
  resolveNextQuickRunCodeTaskId,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildQuickRunNextDispatchExecutedTimelineEntry,
  buildQuickRunNextDispatchPlannedTimelineEntry,
  buildQuickRunNextDispatchSkippedTimelineEntry,
} from "@/lib/prototype/quickRunNextDispatchTimeline";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { prisma } from "@/lib/prisma";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  appendPromptTimeline,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import { advanceImplementationRuntimeCodeTaskQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";

export type ServerQuickRunContinuationOutcome =
  | "dispatched"
  | "no_next_task"
  | "blocked_by_dependency"
  | "queue_state_mismatch"
  | "already_in_flight"
  | "prompt_gate_failed"
  | "execute_request_failed"
  | "skipped";

export type ServerQuickRunContinuationResult = Readonly<{
  readonly ok: boolean;
  readonly outcome: ServerQuickRunContinuationOutcome;
  readonly nextTaskId?: string | null;
  readonly nextCodeTaskId?: string | null;
  readonly reason?: string | null;
  readonly diagnostics?: unknown;
  readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
  allowedPathGlobs: true,
  autoCommit: true,
  autoPush: true,
  autoPr: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
} as const;

export async function continueSelectedCodeTaskQueueAfterAutoGate(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId?: string | null;
  readonly sourceCommitSha?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
}): Promise<ServerQuickRunContinuationResult> {
  const pid = input.projectId.trim();
  const completedTaskId = input.completedTaskId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  const appendSkipped = (
    outcome: ServerQuickRunContinuationOutcome,
    reason: string,
    extra?: {
      readonly nextTaskId?: string | null;
      readonly nextCodeTaskId?: string | null;
      readonly diagnostics?: unknown;
    },
  ): ServerQuickRunContinuationResult => {
    const completedCodeTaskId =
      input.completedCodeTaskId?.trim() ||
      extra?.nextCodeTaskId ||
      "unknown";
    timelineEntries.push(
      buildQuickRunNextDispatchSkippedTimelineEntry({
        projectId: pid,
        completedTaskId,
        completedCodeTaskId: input.completedCodeTaskId?.trim() || completedCodeTaskId,
        nextTaskId: extra?.nextTaskId ?? null,
        nextCodeTaskId: extra?.nextCodeTaskId ?? null,
        reason,
        diagnostics: extra?.diagnostics ?? { outcome },
        nowIso,
      }),
    );
    return {
      ok: false,
      outcome,
      nextTaskId: extra?.nextTaskId ?? null,
      nextCodeTaskId: extra?.nextCodeTaskId ?? null,
      reason,
      diagnostics: extra?.diagnostics,
      timelineEntries,
    };
  };

  if (!pid || !completedTaskId) {
    return appendSkipped("skipped", "missing_project_or_task");
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const requirementsState =
    parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  const taskCursor = parseTaskCursorExecutionV1(requirementsState.taskCursorExecutionV1);
  const runs = parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1);
  const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
  const workItems = requirementsState.cursorWorkItemsV1 ?? [];

  const completedCodeTaskId =
    input.completedCodeTaskId?.trim() ||
    (taskCursor
      ? resolveCompletedCodeTaskId({
          execution: taskCursor,
          runs,
          queue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
          codeTaskPlan,
          taskList,
          cursorWorkItems: workItems,
        })
      : null);

  if (!completedCodeTaskId) {
    return appendSkipped("queue_state_mismatch", "completed_code_task_unresolved", {
      diagnostics: { completedTaskId },
    });
  }

  const bundle = await getImplementationRuntimeBundle(pid);
  const dbQueueSnapshot = bundle.job
    ? await buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle })
    : null;
  const queue = resolveEffectiveCodeTaskExecutionQueue({
    dbQueueSnapshot,
    jsonQueue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
    dbJobStatus: bundle.job?.status ?? null,
  });

  if (bundle.job?.status === "running" && bundle.job.id) {
    await advanceImplementationRuntimeCodeTaskQueue({
      projectId: pid,
      jobId: bundle.job.id,
      stopOnFailure: false,
      now: new Date(nowIso),
    });
  }

  const bundleAfterAdvance = await getImplementationRuntimeBundle(pid);
  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
    queue,
    completedCodeTaskId,
    dbBundle: bundleAfterAdvance,
  });

  if (!nextCodeTaskId?.trim()) {
    return appendSkipped("no_next_task", "no_next_task", {
      nextCodeTaskId: null,
      diagnostics: { completedCodeTaskId },
    });
  }

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: nextCodeTaskId,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
  });
  if (!dispatchTarget) {
    return appendSkipped("queue_state_mismatch", "dispatch_target_not_found", {
      nextCodeTaskId,
    });
  }

  if (codeTaskPlan) {
    const dep = checkCodeTaskDependencyReady({
      codeTaskId: nextCodeTaskId,
      codeTaskPlan,
      runs,
    });
    if (dep.status !== "ready") {
      return appendSkipped("blocked_by_dependency", dep.message ?? "blocked_by_dependency", {
        nextTaskId: dispatchTarget.parentTaskId,
        nextCodeTaskId,
        diagnostics: dep,
      });
    }
  }

  if (
    taskCursor &&
    isInFlightTaskCursorExecution(taskCursor) &&
    taskCursor.taskId !== dispatchTarget.parentTaskId
  ) {
    return appendSkipped("already_in_flight", "already_in_flight", {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      diagnostics: { cursorStatus: taskCursor.status, cursorTaskId: taskCursor.taskId },
    });
  }

  const workBranch = buildCodeTaskWorkBranch(nextCodeTaskId);
  timelineEntries.push(
    buildQuickRunNextDispatchPlannedTimelineEntry({
      projectId: pid,
      completedTaskId,
      completedCodeTaskId,
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      sourceCommitSha: input.sourceCommitSha,
      nowIso,
    }),
  );

  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId: pid },
    select: EXECUTION_SETUP_SELECT,
  });
  const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
  const readiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup,
    env: process.env as Record<string, string | undefined>,
  });
  const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
  if (!readiness.ok || !cursorApiToken) {
    return appendSkipped("execute_request_failed", "execution_setup_not_ready", {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      diagnostics: readiness.ok ? null : readiness,
    });
  }

  const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
    projectId: pid,
    dispatch: {
      codeTaskId: nextCodeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      triggerKey: `${completedTaskId}:${input.sourceCommitSha ?? ""}:server:${nextCodeTaskId}`,
    },
    baseOrchestrationPatch: {},
    requirementsSlice: requirementsState,
    context: readiness.context,
    cursorApiToken,
    nowIso,
  });

  if (!dispatchOutcome.dispatched) {
    const reason = dispatchOutcome.message?.includes("품질")
      ? "prompt_gate_failed"
      : "execute_request_failed";
    return appendSkipped(reason, dispatchOutcome.message ?? reason, {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      diagnostics: { message: dispatchOutcome.message },
    });
  }

  timelineEntries.push(
    buildQuickRunNextDispatchExecutedTimelineEntry({
      projectId: pid,
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      workBranch,
      nowIso,
    }),
  );

  const patch = dispatchOutcome.orchestrationPatch;
  const mergedTimeline = appendPromptTimeline(
    requirementsState.promptTimeline ?? [],
    ...timelineEntries,
  );

  return {
    ok: true,
    outcome: "dispatched",
    nextTaskId: dispatchTarget.parentTaskId,
    nextCodeTaskId,
    reason: null,
    orchestrationPatch: {
      ...patch,
      promptTimeline: mergedTimeline,
    },
    timelineEntries,
  };
}
