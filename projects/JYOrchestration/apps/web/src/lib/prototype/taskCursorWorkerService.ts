import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import {
  appendImplementationExecutionLogTimeline,
  buildPromptTimelineOrchestrationPatch,
  buildTaskCursorJobLifecycleTimelineEntry,
  buildTaskCursorPollLifecycleTimelineEntry,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveTaskCursorPollWorkItems } from "@/lib/prototype/taskCursorClientPollLoop";
import {
  claimDueTaskCursorJobs,
  clearTaskCursorJobLock,
  isJobPollTimedOut,
  markTaskCursorJobTimeout,
  parseTaskCursorJobExecution,
  releaseStaleTaskCursorJobLocks,
  TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS,
  updateTaskCursorJobAfterPoll,
  type TaskCursorExecutionJobRow,
} from "@/lib/prototype/taskCursorExecutionJobRepository";
import { isTerminalTaskCursorPollResultStatus } from "@/lib/prototype/taskCursorExecutionJobTypes";
import { launchTaskCursorForProject } from "@/lib/prototype/taskCursorLaunchService";
import {
  mergeOrchestrationPatchIntoRequirementsState,
  persistTaskCursorOrchestrationToProject,
} from "@/lib/prototype/taskCursorJobStateSync";
import { pollTaskCursorExecutionOnce } from "@/lib/prototype/taskCursorPollService";
import { enqueueNextTaskCursorJobAfterTerminal } from "@/lib/prototype/taskCursorServerAutoChain";
import { buildTaskCursorFailedOrchestrationPatch } from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
  allowedPathGlobs: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
} as const;

export type TaskCursorWorkerTickResult = Readonly<{
  readonly jobId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly status: string;
  readonly terminal: boolean;
  readonly message?: string;
}>;

async function loadPollRuntimeContext(projectId: string) {
  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: EXECUTION_SETUP_SELECT,
  });
  const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
  const readiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup,
    env: process.env as Record<string, string | undefined>,
  });
  if (!readiness.ok) {
    return { ok: false as const, message: readiness.message };
  }
  const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
  const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
  if (!cursorApiToken) {
    return { ok: false as const, message: "Cursor API Key가 없습니다." };
  }
  return {
    ok: true as const,
    context: {
      cursorApiUrl: readiness.context.cursorApiUrl!,
      cursorApiToken,
      githubToken,
      targetRepository: readiness.context.targetRepository,
      workspaceRoot: readiness.context.workspaceRoot,
      baseBranch: readiness.context.baseBranch,
      allowedPathGlobs: readiness.context.allowedPathGlobs,
    },
  };
}

function resolveWorkItemsForJob(
  job: TaskCursorExecutionJobRow,
  stateWorkItems: readonly CursorWorkItem[] | null | undefined,
): readonly CursorWorkItem[] {
  const execution = parseTaskCursorJobExecution(job);
  if (!execution) return stateWorkItems ?? [];
  return resolveTaskCursorPollWorkItems(execution, stateWorkItems ?? []);
}

async function appendJobTimelinePatch(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly jobId: string;
  readonly action: Parameters<typeof buildTaskCursorJobLifecycleTimelineEntry>[0]["action"];
  readonly status?: string;
  readonly pollCount?: number;
  readonly message?: string;
  readonly nowIso: string;
}) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { requirementsStateJson: true },
  });
  const timelineEntry = buildTaskCursorJobLifecycleTimelineEntry({
    action: input.action,
    projectId: input.projectId,
    taskId: input.taskId,
    jobId: input.jobId,
    status: input.status,
    pollCount: input.pollCount,
    message: input.message,
    nowIso: input.nowIso,
  });
  const patch = buildPromptTimelineOrchestrationPatch(
    parseRequirementsStateJson(project?.requirementsStateJson).promptTimeline,
    timelineEntry,
  );
  await persistTaskCursorOrchestrationToProject({
    projectId: input.projectId,
    orchestrationPatch: patch,
  });
}

async function processQueuedTaskCursorJob(
  job: TaskCursorExecutionJobRow,
  now: Date,
): Promise<TaskCursorWorkerTickResult> {
  const nowIso = now.toISOString();
  const project = await prisma.project.findUnique({
    where: { id: job.projectId },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(project?.requirementsStateJson);
  const workItems = resolveWorkItemsForJob(job, state.cursorWorkItemsV1 ?? []);
  const launch = await launchTaskCursorForProject({
    projectId: job.projectId,
    taskId: job.taskId,
    workItems,
    nowIso,
  });
  if (launch.orchestrationPatch) {
    await persistTaskCursorOrchestrationToProject({
      projectId: job.projectId,
      orchestrationPatch: launch.orchestrationPatch,
    });
  }
  const execution = launch.execution;
  if (!execution) {
    await updateTaskCursorJobAfterPoll({
      jobId: job.id,
      execution: parseTaskCursorJobExecution(job)!,
      status: "failed",
      pollCount: job.pollCount,
      lastPollAt: now,
      failureReason: "unknown",
      errorMessage: launch.message ?? "launch failed",
      terminal: true,
    });
    return {
      jobId: job.id,
      projectId: job.projectId,
      taskId: job.taskId,
      status: "failed",
      terminal: true,
      message: launch.message,
    };
  }

  const nextPollAt = launch.ok ? new Date(now.getTime() + TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS) : null;
  await updateTaskCursorJobAfterPoll({
    jobId: job.id,
    execution,
    status: execution.status,
    pollCount: job.pollCount,
    lastPollAt: now,
    nextPollAt,
    terminal: !launch.ok,
  });
  if (launch.ok) {
    await appendJobTimelinePatch({
      projectId: job.projectId,
      taskId: job.taskId,
      jobId: job.id,
      action: "task_cursor_job_tick",
      status: execution.status,
      message: "queued job launched",
      nowIso,
    });
  }
  return {
    jobId: job.id,
    projectId: job.projectId,
    taskId: job.taskId,
    status: execution.status,
    terminal: !launch.ok,
    message: launch.message,
  };
}

async function processPollingTaskCursorJob(
  job: TaskCursorExecutionJobRow,
  now: Date,
): Promise<TaskCursorWorkerTickResult> {
  const nowIso = now.toISOString();
  if (isJobPollTimedOut(job, now)) {
    const execution = parseTaskCursorJobExecution(job);
    if (execution) {
      const timeoutPatch = buildTaskCursorFailedOrchestrationPatch({
        execution,
        message: "Cloud Agent 폴링 시간 초과",
        reason: "poll_timeout",
        history: null,
        existingTimeline: null,
        nowIso,
      });
      await persistTaskCursorOrchestrationToProject({
        projectId: job.projectId,
        orchestrationPatch: timeoutPatch,
      });
      await markTaskCursorJobTimeout({ jobId: job.id, execution, now });
    }
    return {
      jobId: job.id,
      projectId: job.projectId,
      taskId: job.taskId,
      status: "timeout",
      terminal: true,
      message: "poll timeout",
    };
  }

  const runtime = await loadPollRuntimeContext(job.projectId);
  if (!runtime.ok) {
    return {
      jobId: job.id,
      projectId: job.projectId,
      taskId: job.taskId,
      status: job.status,
      terminal: false,
      message: runtime.message,
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: job.projectId },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(project?.requirementsStateJson);
  const execution =
    parseTaskCursorJobExecution(job) ?? parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
  if (!execution) {
    return {
      jobId: job.id,
      projectId: job.projectId,
      taskId: job.taskId,
      status: "failed",
      terminal: true,
      message: "execution missing",
    };
  }

  const workItems = resolveWorkItemsForJob(job, state.cursorWorkItemsV1 ?? []);
  const pollResult = await pollTaskCursorExecutionOnce({
    projectId: job.projectId,
    execution,
    workItems,
    implementationTaskExecutionStateV1: parseImplementationTaskExecutionStateV1(
      state.implementationTaskExecutionStateV1,
    ),
    existingCodeTaskExecutionFeedback: state.implementationCodeTaskExecutionFeedbackV1 ?? null,
    codeTaskQualityGate: state.implementationCodeTaskQualityGateV1 ?? null,
    verifyGithub: true,
    nowIso,
    context: runtime.context,
  });

  const tickTimeline = buildTaskCursorPollLifecycleTimelineEntry({
    action: "task_cursor_poll_tick",
    projectId: job.projectId,
    taskId: job.taskId,
    runId: pollResult.execution.cursorRunId,
    round: job.pollCount + 1,
    agentStatus: pollResult.agentStatus,
    executionStatus: pollResult.status,
    message: pollResult.message,
    nowIso,
  });
  const mergedPatch = mergeOrchestrationPatchIntoRequirementsState(state, {
    ...pollResult.orchestrationPatch,
    promptTimeline: appendImplementationExecutionLogTimeline(
      pollResult.orchestrationPatch.promptTimeline ?? state.promptTimeline,
      tickTimeline,
    ),
  });
  await prisma.project.update({
    where: { id: job.projectId },
    data: { requirementsStateJson: mergedPatch as object },
  });

  const pollCount = job.pollCount + 1;
  const terminal = pollResult.terminal || isTerminalTaskCursorPollResultStatus(pollResult.status);
  const nextPollAt = terminal
    ? null
    : new Date(now.getTime() + (pollResult.nextPollDelayMs ?? TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS));

  await updateTaskCursorJobAfterPoll({
    jobId: job.id,
    execution: pollResult.execution,
    status: pollResult.status,
    pollCount,
    lastPollAt: now,
    nextPollAt,
    failureReason: pollResult.execution.failureReason ?? null,
    errorMessage: pollResult.message ?? pollResult.execution.errorMessage ?? null,
    terminal,
  });

  await appendJobTimelinePatch({
    projectId: job.projectId,
    taskId: job.taskId,
    jobId: job.id,
    action: terminal ? "task_cursor_job_completed" : "task_cursor_job_tick",
    status: pollResult.status,
    pollCount,
    message: pollResult.message,
    nowIso,
  });

  if (terminal) {
    const followUp = await enqueueNextTaskCursorJobAfterTerminal({
      projectId: job.projectId,
      execution: pollResult.execution,
      requirementsState: mergedPatch,
      now,
    });
    if (followUp.orchestrationPatch) {
      await persistTaskCursorOrchestrationToProject({
        projectId: job.projectId,
        orchestrationPatch: followUp.orchestrationPatch,
      });
    }
  }

  return {
    jobId: job.id,
    projectId: job.projectId,
    taskId: job.taskId,
    status: pollResult.status,
    terminal,
    message: pollResult.message,
  };
}

export async function runTaskCursorWorkerTick(input: {
  readonly workerId: string;
  readonly limit?: number;
  readonly now?: Date;
}): Promise<readonly TaskCursorWorkerTickResult[]> {
  const now = input.now ?? new Date();
  await releaseStaleTaskCursorJobLocks(now);
  const jobs = await claimDueTaskCursorJobs({
    workerId: input.workerId,
    limit: input.limit ?? 1,
    now,
  });

  const results: TaskCursorWorkerTickResult[] = [];
  for (const job of jobs) {
    try {
      await appendJobTimelinePatch({
        projectId: job.projectId,
        taskId: job.taskId,
        jobId: job.id,
        action: "task_cursor_job_claimed",
        status: job.status,
        nowIso: now.toISOString(),
      });
      const result =
        job.status === "queued"
          ? await processQueuedTaskCursorJob(job, now)
          : await processPollingTaskCursorJob(job, now);
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        jobId: job.id,
        projectId: job.projectId,
        taskId: job.taskId,
        status: job.status,
        terminal: false,
        message,
      });
    } finally {
      await clearTaskCursorJobLock(job.id);
    }
  }
  return results;
}

export async function claimTaskCursorJobsForWorker(input: {
  readonly workerId: string;
  readonly limit?: number;
  readonly now?: Date;
}): Promise<readonly TaskCursorExecutionJobRow[]> {
  await releaseStaleTaskCursorJobLocks(input.now ?? new Date());
  return claimDueTaskCursorJobs(input);
}
