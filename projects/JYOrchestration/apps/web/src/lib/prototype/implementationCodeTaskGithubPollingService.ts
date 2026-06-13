import { resolveTaskCursorExecutionForRow } from "@/lib/prototype/codeAgentExecutionProgressView";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  CODE_TASK_EXECUTION_RUN_VERSION,
} from "@/lib/prototype/codeTaskExecutionRun";
import { buildGithubVerifyExecutionFromRunContext } from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildImplementationExecutionUnitGithubPollTimelineEntry,
  CODE_TASK_GITHUB_POLL_INTERVAL_MS,
} from "@/lib/prototype/implementationGithubPollingScheduler";
import {
  listActiveCodeTaskGithubPollingEntries,
  parseImplementationCodeTaskGithubPollingStateV1,
  type CodeTaskGithubPollingEntryV1,
  type CodeTaskGithubPollingStatusV1,
  upsertCodeTaskGithubPollingEntryInState,
} from "@/lib/prototype/implementationCodeTaskGithubPollingState";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import { runTaskCursorGithubVerifyWithQuickRunAdvance } from "@/lib/prototype/taskCursorGithubVerifyService";
import type { TaskCursorGithubVerifyRequestBody } from "@/lib/prototype/taskCursorGithubVerifyTypes";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isTransientTaskCursorGithubVerifyMiss } from "@/lib/prototype/taskCursorGithubVerify";
import { prisma } from "@/lib/prisma";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendImplementationExecutionLogTimeline } from "@/lib/prototype/implementationExecutionLogTimeline";

export type CodeTaskGithubPollingTickResult = Readonly<{
  readonly checkedCount: number;
  readonly passedCount: number;
  readonly retryCount: number;
  readonly failedCount: number;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}>;

function parseMs(iso: string | null | undefined): number | null {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : null;
}

function scheduleNextPollAt(nowMs: number): string {
  return new Date(nowMs + CODE_TASK_GITHUB_POLL_INTERVAL_MS).toISOString();
}

function buildVerifyBody(
  projectId: string,
  state: RequirementsStateJson,
  codeTaskId: string,
  execution: NonNullable<ReturnType<typeof parseTaskCursorExecutionV1>>,
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
    codeTaskExecutionQueueV1: state.codeTaskExecutionQueueV1,
    workItems: state.cursorWorkItemsV1 ?? [],
  };
}

function resolveExecutionForPolling(input: {
  readonly state: RequirementsStateJson;
  readonly entry: CodeTaskGithubPollingEntryV1;
}) {
  const { entry, state } = input;
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
  const parentTaskId =
    entry.processTaskId?.trim() ||
    codeTaskPlan?.tasks.find((t) => t.codeTaskId === entry.codeTaskId)?.parentTaskId?.trim() ||
    "";
  if (!parentTaskId) return null;

  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const run = findLatestRunForCodeTask(runs, entry.codeTaskId);
  const historyExecution = resolveTaskCursorExecutionForRow({
    taskId: parentTaskId,
    taskCursorExecutionV1: parseTaskCursorExecutionV1(state.taskCursorExecutionV1),
    taskCursorExecutionHistoryV1: state.taskCursorExecutionHistoryV1,
  });

  return buildGithubVerifyExecutionFromRunContext({
    projectId: entry.projectId,
    parentTaskId,
    codeTaskId: entry.codeTaskId,
    run: run ?? {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: entry.unitId,
      projectId: entry.projectId,
      processTaskId: parentTaskId,
      workItemId: "",
      codeTaskId: entry.codeTaskId,
      status: "cursor_running",
      attemptNo: 1,
      workBranch: entry.workBranch,
      createdAt: entry.dispatchedAt,
      updatedAt: entry.dispatchedAt,
    },
    execution: historyExecution,
    codeTaskPlan: codeTaskPlan ?? undefined,
  });
}

async function processPollingEntry(input: {
  readonly state: RequirementsStateJson;
  readonly entry: CodeTaskGithubPollingEntryV1;
  readonly nowIso: string;
  readonly nowMs: number;
}): Promise<{
  readonly entry: CodeTaskGithubPollingEntryV1;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly outcome: "waiting" | "retry" | "passed" | "failed";
}> {
  const { nowIso, nowMs } = input;
  const entry = input.entry;
  const timeline: RequirementsPromptTimelineEntry[] = [];
  let orchestrationPatch: Partial<RequirementsStateJson> = {};
  const firstPollMs = parseMs(entry.firstPollAt);
  const timeoutMs = parseMs(entry.timeoutAt);
  const nextPollMs = parseMs(entry.nextPollAt);
  const dispatchedMs = parseMs(entry.dispatchedAt);
  const elapsedMs = dispatchedMs != null ? Math.max(0, nowMs - dispatchedMs) : undefined;

  const timelineBase = {
    projectId: entry.projectId,
    unitId: entry.unitId,
    codeTaskId: entry.codeTaskId,
    processTaskId: entry.processTaskId,
    targetRepository: entry.targetRepository,
    baseBranch: entry.baseBranch,
    workBranch: entry.workBranch,
    pollAttempt: entry.attemptCount + 1,
    elapsedMs,
    timeoutAt: entry.timeoutAt,
    nowIso,
  };

  if (timeoutMs != null && nowMs >= timeoutMs) {
    const failedEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: "timeout",
      githubVerifyStatus: "failed",
      lastErrorCode: entry.lastErrorCode ?? "github_branch_missing",
      lastErrorMessage: entry.lastErrorMessage ?? "GitHub polling timeout",
    };
    timeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_verify_timeout",
        errorCode: failedEntry.lastErrorCode,
        errorMessage: failedEntry.lastErrorMessage,
      }),
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_verify_failed",
        errorCode: failedEntry.lastErrorCode,
        errorMessage: failedEntry.lastErrorMessage,
      }),
    );
    orchestrationPatch = upsertCodeTaskGithubPollingEntryInState({
      state: input.state,
      entry: failedEntry,
      nowIso,
    });
    return { entry: failedEntry, timeline, orchestrationPatch, outcome: "failed" };
  }

  if (firstPollMs != null && nowMs < firstPollMs) {
    const waitingEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: entry.status === "scheduled" ? "waiting" : entry.status,
      nextPollAt: entry.firstPollAt,
    };
    if (waitingEntry.status === "waiting" && entry.status !== "waiting") {
      timeline.push(
        buildImplementationExecutionUnitGithubPollTimelineEntry({
          ...timelineBase,
          action: "implementation_execution_unit_github_poll_waiting",
        }),
      );
    }
    orchestrationPatch = upsertCodeTaskGithubPollingEntryInState({
      state: input.state,
      entry: waitingEntry,
      nowIso,
    });
    return { entry: waitingEntry, timeline, orchestrationPatch, outcome: "waiting" };
  }

  if (nextPollMs != null && nowMs < nextPollMs) {
    return {
      entry,
      timeline,
      orchestrationPatch: {},
      outcome: "waiting",
    };
  }

  const execution = resolveExecutionForPolling({ state: input.state, entry });
  if (!execution) {
    const retryEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: "branch_missing_retrying",
      nextPollAt: scheduleNextPollAt(nowMs),
      lastErrorCode: "execution_context_missing",
      lastErrorMessage: "GitHub verify execution context missing",
    };
    orchestrationPatch = upsertCodeTaskGithubPollingEntryInState({
      state: input.state,
      entry: retryEntry,
      nowIso,
    });
    return { entry: retryEntry, timeline, orchestrationPatch, outcome: "retry" };
  }

  timeline.push(
    buildImplementationExecutionUnitGithubPollTimelineEntry({
      ...timelineBase,
      action: "implementation_execution_unit_github_poll_started",
    }),
    buildImplementationExecutionUnitGithubPollTimelineEntry({
      ...timelineBase,
      action: "implementation_execution_unit_github_branch_lookup_requested",
    }),
  );

  const body = buildVerifyBody(entry.projectId, input.state, entry.codeTaskId, execution);
  const verifyOutcome = await runTaskCursorGithubVerifyWithQuickRunAdvance({
    projectId: entry.projectId,
    body,
    execution,
  });

  const attemptCount = entry.attemptCount + 1;
  const nextPollAt = scheduleNextPollAt(nowMs);

  if (verifyOutcome.kind === "blocked") {
    const retryEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: "branch_missing_retrying",
      attemptCount,
      nextPollAt,
      lastPolledAt: nowIso,
      lastErrorCode: "verify_blocked",
      lastErrorMessage: verifyOutcome.message,
    };
    timeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_branch_missing_retry_scheduled",
        nextPollAt,
        errorCode: retryEntry.lastErrorCode,
        errorMessage: retryEntry.lastErrorMessage,
      }),
    );
    orchestrationPatch = upsertCodeTaskGithubPollingEntryInState({
      state: mergeRequirementsStateJson(input.state, orchestrationPatch),
      entry: retryEntry,
      nowIso,
    });
    return { entry: retryEntry, timeline, orchestrationPatch, outcome: "retry" };
  }

  orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, verifyOutcome.orchestrationPatch);

  const verify = verifyOutcome.verify;
  if (verify.ok && verify.verifiedCommitSha) {
    const passedEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: "passed",
      githubVerifyStatus: "passed",
      branchHeadCommit: verify.verifiedCommitSha,
      attemptCount,
      lastPolledAt: nowIso,
      nextPollAt,
    };
    timeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_head_commit_resolved",
        branchHeadCommit: verify.verifiedCommitSha,
      }),
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_verify_passed",
        branchHeadCommit: verify.verifiedCommitSha,
      }),
    );
    orchestrationPatch = mergeOrchestrationPersistPatches(
      orchestrationPatch,
      upsertCodeTaskGithubPollingEntryInState({
        state: mergeRequirementsStateJson(input.state, orchestrationPatch),
        entry: passedEntry,
        nowIso,
      }),
    );
    return { entry: passedEntry, timeline, orchestrationPatch, outcome: "passed" };
  }

  if (isTransientTaskCursorGithubVerifyMiss(verify)) {
    const retryEntry: CodeTaskGithubPollingEntryV1 = {
      ...entry,
      status: "branch_missing_retrying",
      attemptCount,
      lastPolledAt: nowIso,
      nextPollAt,
      lastErrorCode: verify.reason ?? verify.uiReason ?? "github_branch_missing",
      lastErrorMessage: verify.message,
    };
    timeline.push(
      buildImplementationExecutionUnitGithubPollTimelineEntry({
        ...timelineBase,
        action: "implementation_execution_unit_github_branch_missing_retry_scheduled",
        nextPollAt,
        errorCode: retryEntry.lastErrorCode,
        errorMessage: retryEntry.lastErrorMessage,
      }),
    );
    orchestrationPatch = mergeOrchestrationPersistPatches(
      orchestrationPatch,
      upsertCodeTaskGithubPollingEntryInState({
        state: mergeRequirementsStateJson(input.state, orchestrationPatch),
        entry: retryEntry,
        nowIso,
      }),
    );
    return { entry: retryEntry, timeline, orchestrationPatch, outcome: "retry" };
  }

  const failedEntry: CodeTaskGithubPollingEntryV1 = {
    ...entry,
    status: "failed" satisfies CodeTaskGithubPollingStatusV1,
    githubVerifyStatus: "failed",
    attemptCount,
    lastPolledAt: nowIso,
    nextPollAt,
    lastErrorCode: verify.reason ?? verify.detailReason ?? "github_verify_failed",
    lastErrorMessage: verify.message,
  };
  timeline.push(
    buildImplementationExecutionUnitGithubPollTimelineEntry({
      ...timelineBase,
      action: "implementation_execution_unit_github_verify_failed",
      errorCode: failedEntry.lastErrorCode,
      errorMessage: failedEntry.lastErrorMessage,
    }),
  );
  orchestrationPatch = mergeOrchestrationPersistPatches(
    orchestrationPatch,
    upsertCodeTaskGithubPollingEntryInState({
      state: mergeRequirementsStateJson(input.state, orchestrationPatch),
      entry: failedEntry,
      nowIso,
    }),
  );
  return { entry: failedEntry, timeline, orchestrationPatch, outcome: "failed" };
}

/** CodeTask dispatch 후 persisted polling state 기준 GitHub verify tick (normal path). */
export async function runCodeTaskGithubPollingTick(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): Promise<CodeTaskGithubPollingTickResult> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const empty: CodeTaskGithubPollingTickResult = {
    checkedCount: 0,
    passedCount: 0,
    retryCount: 0,
    failedCount: 0,
    orchestrationPatch: {},
    timeline: [],
  };
  if (!pid) return empty;

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  let state = parseRequirementsStateJson(project?.requirementsStateJson);
  const active = listActiveCodeTaskGithubPollingEntries(state);
  if (!active.length) return empty;

  let checkedCount = 0;
  let passedCount = 0;
  let retryCount = 0;
  let failedCount = 0;
  let mergedPatch: Partial<RequirementsStateJson> = {};
  let timeline: RequirementsPromptTimelineEntry[] = [];

  for (const entry of active) {
    const workingState = mergeRequirementsStateJson(state, mergedPatch);
    const result = await processPollingEntry({
      state: workingState,
      entry,
      nowIso,
      nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
    });
    checkedCount += 1;
    if (result.outcome === "passed") passedCount += 1;
    else if (result.outcome === "retry" || result.outcome === "waiting") retryCount += 1;
    else if (result.outcome === "failed") failedCount += 1;
    mergedPatch = mergeOrchestrationPersistPatches(mergedPatch, result.orchestrationPatch);
    timeline = appendImplementationExecutionLogTimeline(timeline, ...result.timeline);
  }

  if (Object.keys(mergedPatch).length > 0) {
    const mergedState = mergeRequirementsStateJson(state, mergedPatch);
    const pollingState = parseImplementationCodeTaskGithubPollingStateV1(
      mergedState.implementationCodeTaskGithubPollingV1,
    );
    if (pollingState) {
      mergedPatch = {
        ...mergedPatch,
        implementationCodeTaskGithubPollingV1: {
          ...pollingState,
          updatedAt: nowIso,
        },
      };
    }
    if (timeline.length) {
      mergedPatch = {
        ...mergedPatch,
        promptTimeline: appendImplementationExecutionLogTimeline(mergedState.promptTimeline, ...timeline),
      };
    }

    await prisma.project.update({
      where: { id: pid },
      data: {
        requirementsStateJson: mergeRequirementsStateJson(state, mergedPatch) as object,
      },
    });
  }

  return {
    checkedCount,
    passedCount,
    retryCount,
    failedCount,
    orchestrationPatch: mergedPatch,
    timeline,
  };
}
