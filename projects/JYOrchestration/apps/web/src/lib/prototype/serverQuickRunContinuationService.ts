import { checkCodeTaskDependencyReady } from "@/lib/prototype/codeTaskDependencyResolver";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { resolveNextQuickRunCodeTaskId } from "@/lib/prototype/implementationSelectedCodeTaskSequence";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import { resolveCompletedCodeTaskId } from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
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
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import {
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import { advanceImplementationRuntimeJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import {
  getImplementationRuntimeBundle,
  getImplementationRuntimeJobWithRuns,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";

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

async function advanceJobWhenCompletedCodeTaskIsTerminal(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly completedCodeTaskId: string;
}): Promise<void> {
  const job = await getImplementationRuntimeJobWithRuns({
    projectId: input.projectId,
    jobId: input.jobId,
  });
  if (!job || job.status !== "running") return;
  const completedRun = job.runs.find((r) => r.codeTaskId === input.completedCodeTaskId);
  if (!completedRun || !isTerminalRuntimeState(completedRun.runtimeState)) return;
  if (job.currentCodeTaskId?.trim() !== input.completedCodeTaskId) return;
  await advanceImplementationRuntimeJob({
    projectId: input.projectId,
    jobId: input.jobId,
  });
}

function ensureJsonRunForQueuedCodeTask(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly runs: ReturnType<typeof parseCodeTaskExecutionRunsV1>;
  readonly codeTaskPlan: ReturnType<typeof parseImplementationCodeTaskPlanV1>;
  readonly taskList: ReturnType<typeof parseImplementationTaskListV1>;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly nowIso: string;
}): NonNullable<ReturnType<typeof parseCodeTaskExecutionRunsV1>> {
  const runs = input.runs ?? [];
  const existing = findLatestRunForCodeTask(runs, input.codeTaskId);
  if (existing) return runs;
  const target = resolveCodeTaskDispatchTarget({
    codeTaskId: input.codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!target) return runs;
  const created = createCodeTaskExecutionRun({
    projectId: input.projectId,
    processTaskId: target.parentTaskId,
    workItemId: target.workItem.id,
    codeTaskId: input.codeTaskId,
    runs,
    nowIso: input.nowIso,
  });
  return appendCodeTaskExecutionRun(runs, created);
}

/**
 * DB job/run이 다음 CodeTask queued로 넘어간 뒤 서버에서 Cursor dispatch (Quick Run 연속 실행).
 * JSON taskCursor가 이전 Task in-flight여도 DB queued면 진행한다.
 */
export async function tryDispatchCurrentQueuedQuickRunAfterDbAdvance(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): Promise<ServerQuickRunContinuationResult> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  const appendSkipped = (
    outcome: ServerQuickRunContinuationOutcome,
    reason: string,
    extra?: Partial<ServerQuickRunContinuationResult>,
  ): ServerQuickRunContinuationResult => ({
    ok: false,
    outcome,
    reason,
    timelineEntries,
    ...extra,
  });

  const bundle = await getImplementationRuntimeBundle(pid);
  const run = bundle.currentRun;
  const job = bundle.job;
  if (!job?.id || job.status !== "running" || !run || run.runtimeState !== "queued") {
    return appendSkipped("skipped", "no_queued_db_run");
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const requirementsState =
    parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  const quickRun = parseImplementationQuickRunV1(requirementsState.implementationQuickRunV1);
  if (quickRun?.status !== "running") {
    return appendSkipped("skipped", "quick_run_not_running");
  }

  const codeTaskPlan = parseImplementationCodeTaskPlanV1(
    requirementsState.implementationCodeTaskPlanV1,
  );
  const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
  const workItems = requirementsState.cursorWorkItemsV1 ?? [];
  let runs = ensureJsonRunForQueuedCodeTask({
    projectId: pid,
    codeTaskId: run.codeTaskId,
    runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1),
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
    nowIso,
  });

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: run.codeTaskId,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
  });
  if (!dispatchTarget) {
    return appendSkipped("queue_state_mismatch", "dispatch_target_not_found", {
      nextCodeTaskId: run.codeTaskId,
    });
  }

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
    return appendSkipped("execute_request_failed", "execution_setup_not_ready");
  }

  const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
    projectId: pid,
    dispatch: {
      codeTaskId: run.codeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      triggerKey: `db_advance:${run.id}:${nowIso}`,
    },
    baseOrchestrationPatch: { codeTaskExecutionRunsV1: runs },
    requirementsSlice: { ...requirementsState, codeTaskExecutionRunsV1: runs },
    context: readiness.context,
    cursorApiToken,
    nowIso,
  });

  if (!dispatchOutcome.dispatched) {
    return appendSkipped(
      "execute_request_failed",
      dispatchOutcome.message ?? "dispatch_failed",
      { nextCodeTaskId: run.codeTaskId },
    );
  }

  return {
    ok: true,
    outcome: "dispatched",
    nextTaskId: dispatchTarget.parentTaskId,
    nextCodeTaskId: run.codeTaskId,
    reason: null,
    orchestrationPatch: dispatchOutcome.orchestrationPatch,
    timelineEntries,
  };
}

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
      readonly resolvedCompletedCodeTaskId?: string | null;
    },
  ): ServerQuickRunContinuationResult => {
    const completedCodeTaskIdForTimeline =
      extra?.resolvedCompletedCodeTaskId?.trim() ||
      input.completedCodeTaskId?.trim() ||
      "unknown";
    timelineEntries.push(
      buildQuickRunNextDispatchSkippedTimelineEntry({
        projectId: pid,
        completedTaskId,
        completedCodeTaskId: completedCodeTaskIdForTimeline,
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
  if (bundle.job?.status === "running" && bundle.job.id) {
    await advanceJobWhenCompletedCodeTaskIsTerminal({
      projectId: pid,
      jobId: bundle.job.id,
      completedCodeTaskId,
    });
  }

  const bundleAfterAdvance = await getImplementationRuntimeBundle(pid);
  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
    completedCodeTaskId,
    dbBundle: bundleAfterAdvance,
    queue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
  });

  if (!nextCodeTaskId?.trim()) {
    return appendSkipped("no_next_task", "no_next_task", {
      nextCodeTaskId: null,
      resolvedCompletedCodeTaskId: completedCodeTaskId,
      diagnostics: {
        completedCodeTaskId,
        selectedCodeTaskIds: bundleAfterAdvance.job?.selectedCodeTaskIds ?? [],
        jobSelectedCount: bundle.job?.selectedCodeTaskIds.length ?? 0,
        jobCurrentCodeTaskId: bundleAfterAdvance.job?.currentCodeTaskId ?? null,
        currentRunCodeTaskId: bundleAfterAdvance.currentRun?.codeTaskId ?? null,
        currentRunState: bundleAfterAdvance.currentRun?.runtimeState ?? null,
      },
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

  const dbNextRunQueued =
    bundleAfterAdvance.currentRun?.codeTaskId === nextCodeTaskId &&
    bundleAfterAdvance.currentRun.runtimeState === "queued";

  if (
    taskCursor &&
    isInFlightTaskCursorExecution(taskCursor) &&
    taskCursor.taskId !== dispatchTarget.parentTaskId &&
    !dbNextRunQueued
  ) {
    return appendSkipped("already_in_flight", "already_in_flight", {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      diagnostics: { cursorStatus: taskCursor.status, cursorTaskId: taskCursor.taskId },
    });
  }

  if (dbNextRunQueued) {
    const auto = await tryDispatchCurrentQueuedQuickRunAfterDbAdvance({
      projectId: pid,
      nowIso,
    });
    if (auto.ok && auto.orchestrationPatch) {
      return {
        ok: true,
        outcome: "dispatched",
        nextTaskId: auto.nextTaskId ?? dispatchTarget.parentTaskId,
        nextCodeTaskId: auto.nextCodeTaskId ?? nextCodeTaskId,
        reason: null,
        orchestrationPatch: auto.orchestrationPatch,
        timelineEntries: [...timelineEntries, ...auto.timelineEntries],
      };
    }
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
  const mergedTimeline = appendPromptTimelineEntries(
    requirementsState.promptTimeline ?? [],
    timelineEntries,
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
