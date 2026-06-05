import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildGithubVerifyExecutionFromRunContext } from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
type OrphanGithubPollTickResult = Readonly<{
  readonly jobId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly status: string;
  readonly terminal: boolean;
  readonly message?: string;
}>;
import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import {
  isGithubProgressPollDue,
  parseGithubProgressLastCheckMs,
  resolveEffectiveGithubLaunchMs,
  resolveGithubProgressNextPollDelayMs,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { runTaskCursorGithubVerifyWithQuickRunAdvance } from "@/lib/prototype/taskCursorGithubVerifyService";
import type { TaskCursorGithubVerifyRequestBody } from "@/lib/prototype/taskCursorGithubVerifyTypes";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { prisma } from "@/lib/prisma";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  RUNTIME_POLL_SCHEDULE_STATES,
  scheduleImplementationRuntimePoll,
  type ImplementationRuntimePollRunRow,
} from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  allowedPathGlobs: true,
  githubAccessToken: true,
} as const;

function buildVerifyBodyFromState(
  projectId: string,
  state: ReturnType<typeof parseRequirementsStateJson>,
  codeTaskId: string,
  execution: import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1,
): TaskCursorGithubVerifyRequestBody {
  return {
    projectId,
    execution,
    codeTaskId,
    implementationQuickRunV1: state.implementationQuickRunV1,
    implementationTaskListV1: state.implementationTaskListV1,
    implementationCodeTaskPlanV1: state.implementationCodeTaskPlanV1,
    codeTaskExecutionRunsV1: state.codeTaskExecutionRunsV1,
    implementationTaskExecutionStateV1: state.implementationTaskExecutionStateV1,
    implementationQualityGateResultsV1: state.implementationQualityGateResultsV1,
    implementationAutoQualityGateV1: state.implementationAutoQualityGateV1,
    implementationAutoQualityGateHistoryV1: state.implementationAutoQualityGateHistoryV1,
    cursorWorkItemsV1: state.cursorWorkItemsV1,
    promptTimeline: state.promptTimeline,
    workItems: state.cursorWorkItemsV1 ?? [],
  };
}

/** Task Cursor Job이 없어도 DB Run(branch·agent) 기준 GitHub 완료 폴링 */
export async function processOrphanGithubCentricRuntimeRun(input: {
  readonly runRow: ImplementationRuntimePollRunRow;
  readonly now?: Date;
}): Promise<OrphanGithubPollTickResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const runRow = input.runRow;
  const projectId = runRow.projectId.trim();
  const codeTaskId = runRow.codeTaskId.trim();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(project?.requirementsStateJson);
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
  const parentTaskId =
    codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId)?.parentTaskId?.trim() ?? "";
  if (!parentTaskId) {
    return {
      jobId: runRow.id,
      projectId,
      taskId: codeTaskId,
      status: "orphan_poll_skipped",
      terminal: false,
      message: "parentTaskId missing",
    };
  }

  const historyExecution = resolveTaskCursorExecutionForRow({
    taskId: parentTaskId,
    taskCursorExecutionV1: parseTaskCursorExecutionV1(state.taskCursorExecutionV1),
    taskCursorExecutionHistoryV1: state.taskCursorExecutionHistoryV1,
  });

  const jsonRun = {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: runRow.id,
    projectId,
    processTaskId: parentTaskId,
    workItemId: "",
    codeTaskId,
    status: "cursor_running" as const,
    attemptNo: 1,
    cursorRunId: runRow.cursorAgentId ?? undefined,
    workBranch: runRow.branchName ?? undefined,
    createdAt: runRow.startedAt?.toISOString() ?? runRow.createdAt.toISOString(),
    updatedAt: runRow.updatedAt.toISOString(),
    startedAt: runRow.startedAt?.toISOString(),
  };

  const execution = buildGithubVerifyExecutionFromRunContext({
    projectId,
    parentTaskId,
    codeTaskId,
    run: jsonRun,
    execution: historyExecution,
  });

  if (!execution || !String(execution.workBranch ?? "").trim()) {
    return {
      jobId: runRow.id,
      projectId,
      taskId: parentTaskId,
      status: "orphan_poll_skipped",
      terminal: false,
      message: "workBranch missing",
    };
  }

  const launchMs = resolveEffectiveGithubLaunchMs({
    run: jsonRun,
    dbRun: {
      codeTaskId: runRow.codeTaskId,
      runtimeState: runRow.runtimeState,
      startedAt: runRow.startedAt?.toISOString() ?? null,
      updatedAt: runRow.updatedAt.toISOString(),
      branchName: runRow.branchName,
      commitSha: runRow.commitSha,
      cursorAgentId: runRow.cursorAgentId,
      id: runRow.id,
      projectId: runRow.projectId,
      jobId: runRow.jobId,
      pullRequestUrl: runRow.pullRequestUrl,
      failureReason: runRow.failureReason,
      lastHeartbeatAt: runRow.lastHeartbeatAt?.toISOString() ?? null,
      completedAt: runRow.completedAt?.toISOString() ?? null,
      taskCursorJobId: runRow.taskCursorJobId,
    },
    execution,
  });
  const lastCheckMs =
    parseGithubProgressLastCheckMs(execution) ??
    (runRow.lastPollAt ? Date.parse(runRow.lastPollAt.toISOString()) : null);

  if (!isGithubProgressPollDue({ launchMs, lastCheckMs, nowMs: now.getTime() })) {
    const delay = resolveGithubProgressNextPollDelayMs({
      launchMs,
      lastCheckMs,
      nowMs: now.getTime(),
    });
    await scheduleImplementationRuntimePoll({
      runId: runRow.id,
      nextPollAt: new Date(now.getTime() + delay),
      now,
    });
    return {
      jobId: runRow.id,
      projectId,
      taskId: parentTaskId,
      status: "orphan_poll_waiting",
      terminal: false,
      message: `github poll not due (${delay}ms)`,
    };
  }

  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: EXECUTION_SETUP_SELECT,
  });
  if (!String(setupRow?.githubAccessToken ?? "").trim()) {
    return {
      jobId: runRow.id,
      projectId,
      taskId: parentTaskId,
      status: "orphan_poll_blocked",
      terminal: false,
      message: "github token missing",
    };
  }

  const body = buildVerifyBodyFromState(projectId, state, codeTaskId, execution);

  const outcome = await runTaskCursorGithubVerifyWithQuickRunAdvance({
    projectId,
    body,
    execution,
  });

  if (outcome.kind === "blocked") {
    await scheduleImplementationRuntimePoll({
      runId: runRow.id,
      nextPollAt: new Date(now.getTime() + 10_000),
      now,
    });
    return {
      jobId: runRow.id,
      projectId,
      taskId: parentTaskId,
      status: "orphan_poll_blocked",
      terminal: false,
      message: outcome.message,
    };
  }

  await persistTaskCursorOrchestrationToProject({
    projectId,
    orchestrationPatch: outcome.orchestrationPatch,
  });

  const bundle = await getImplementationRuntimeBundle(projectId);
  const dbRun = bundle.runs.find((r) => r.id === runRow.id);
  const terminal = dbRun?.runtimeState === "completed" || dbRun?.runtimeState === "failed";

  await scheduleImplementationRuntimePoll({
    runId: runRow.id,
    nextPollAt: terminal ? null : new Date(now.getTime() + 10_000),
    now,
  });

  console.info(
    "[orphan-github-poll]",
    JSON.stringify({
      projectId,
      codeTaskId,
      verifyOk: outcome.verify.ok,
      runtimeState: dbRun?.runtimeState,
      terminal,
      at: nowIso,
    }),
  );

  return {
    jobId: runRow.id,
    projectId,
    taskId: parentTaskId,
    status: outcome.execution.status,
    terminal,
    message: outcome.verify.ok ? "github verified" : outcome.verify.message,
  };
}

/** 워커 claim이 실패해도 recover=1 시 현재 Run orphan GitHub 폴링을 1회 시도한다. */
export async function pollOrphanGithubCentricRuntimeForProject(
  projectId: string,
  now: Date = new Date(),
): Promise<OrphanGithubPollTickResult | null> {
  const pid = projectId.trim();
  if (!pid) return null;

  const bundle = await getImplementationRuntimeBundle(pid);
  const current = bundle.currentRun;
  if (!current?.id || current.completedAt) return null;
  if (!String(current.branchName ?? "").trim() || !String(current.cursorAgentId ?? "").trim()) {
    return null;
  }
  if (!(RUNTIME_POLL_SCHEDULE_STATES as readonly string[]).includes(current.runtimeState)) {
    return null;
  }

  const row = await prisma.implementationCodeTaskRun.findUnique({
    where: { id: current.id },
    include: { taskCursorJob: true },
  });
  if (!row || row.taskCursorJobId) return null;

  return processOrphanGithubCentricRuntimeRun({ runRow: row, now });
}
