import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findDispatchableRunForCodeTask,
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { reconcileImplementationRunBeforeDispatch } from "@/lib/runtime/implementationRuntime/implementationRuntimeRunDispatch";
import {
  buildImplementationQuickRunStartedPatch,
  parseImplementationQuickRunV1,
  type ImplementationQuickRunV1,
} from "@/lib/prototype/implementationQuickRun";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import {
  detectCodeTaskRunIdentitySplit,
  resolveCanonicalCodeTaskRunId,
} from "@/lib/prototype/codeTaskExecutionRunIdentity";
import { ensureNextQuickRunDispatchRuntimeReady } from "@/lib/prototype/implementationRuntimeRunMaterialization";
import { logImplementationRuntimeStateDiagnostics } from "@/lib/prototype/implementationRuntimeStateDiagnostics";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import { resolveCanonicalCodeTaskForQueuedRun } from "@/lib/prototype/codeTaskCanonicalId";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import {
  buildImplementationQuickRunRequirementsPrepPersistPatch,
  prepareRequirementsStateForImplementationQuickRun,
} from "@/lib/prototype/implementationQuickRunStartService";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  buildQuickRunQueuedTargetBlockedTimelineEntry,
  buildQuickRunQueuedTargetCanonicalizedTimelineEntry,
  buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry,
} from "@/lib/prototype/quickRunVerifiedContinuationTimeline";
import {
  buildQuickRunQueueExhaustedOrchestrationPatch,
  resolveCompletedCodeTaskId,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildQuickRunNextDispatchExecutedTimelineEntry,
  buildQuickRunNextDispatchPlannedTimelineEntry,
  buildQuickRunDbQueuedAutoDispatchTimelineEntry,
  buildQuickRunNextDispatchSkippedTimelineEntry,
  buildQuickRunNextDispatchFailedTimelineEntry,
} from "@/lib/prototype/quickRunNextDispatchTimeline";
import { QUICK_RUN_DISPATCH_REASON } from "@/lib/prototype/quickRunDispatchReasonCodes";
import {
  shouldBlockQuickRunDispatchForInFlightTaskCursor,
  resolveStaleTaskCursorAfterQualityGatePassed,
  buildTaskCursorInflightRepairedTimelineFields,
} from "@/lib/prototype/taskCursorQuickRunInflightPolicy";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  resolveNextExecutionUnitFromRuntime,
  resolveQuickRunExecutionContext,
  shouldMarkQuickRunHasNextDispatch,
} from "@/lib/prototype/implementationQuickRunQueue";
import { countRemainingSelectedExecutionUnits } from "@/lib/prototype/implementationExecutionRuntime";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { prisma } from "@/lib/prisma";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { advanceImplementationRuntimeJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import {
  createImplementationCodeTaskRun,
  getImplementationRuntimeBundle,
  getImplementationRuntimeBundleByJobId,
  getImplementationRuntimeJobWithRuns,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";

function isNonQueuedRuntimeDispatchError(message: string): boolean {
  return /Only queued runs can be dispatched/i.test(String(message ?? ""));
}

export type ServerQuickRunContinuationOutcome =
  | "dispatched"
  | "no_next_task"
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

/** @deprecated legacy_runtime_audit_only — job pointer repair; not used for next-unit resolution (P3-M71). */
async function ensureQuickRunJobPointsAtQueuedRun(input: {
  readonly projectId: string;
  readonly jobId: string;
}): Promise<void> {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  if (!pid || !jobId) return;

  for (let guard = 0; guard < 16; guard += 1) {
    const bundle = await getImplementationRuntimeBundleByJobId({ projectId: pid, jobId });
    const job = bundle.job;
    if (!job || job.status !== "running") return;
    const run = bundle.currentRun;
    if (!run) return;
    if (run.runtimeState === "queued") return;
    if (!isTerminalRuntimeState(run.runtimeState)) return;
    try {
      await advanceImplementationRuntimeJob({ projectId: pid, jobId });
    } catch {
      return;
    }
  }
}

/** @deprecated legacy_runtime_audit_only */
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
  const latestRunByCodeTaskId = new Map<string, (typeof job.runs)[number]>();
  for (const row of job.runs) {
    latestRunByCodeTaskId.set(row.codeTaskId, row);
  }
  const completedRun = latestRunByCodeTaskId.get(input.completedCodeTaskId.trim());
  if (!completedRun || !isTerminalRuntimeState(completedRun.runtimeState)) return;
  if (job.currentCodeTaskId?.trim() !== input.completedCodeTaskId) return;
  try {
    await advanceImplementationRuntimeJob({
      projectId: input.projectId,
      jobId: input.jobId,
    });
  } catch (error) {
    console.warn(
      "[quick-run-continuation] advanceJobWhenCompletedCodeTaskIsTerminal",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** @deprecated legacy_runtime_audit_only — JSON run upsert for legacy paths */
function ensureJsonRunForQueuedCodeTask(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly runs: ReturnType<typeof parseCodeTaskExecutionRunsV1>;
  readonly codeTaskPlan: ReturnType<typeof parseImplementationCodeTaskPlanV1>;
  readonly taskList: ReturnType<typeof parseImplementationTaskListV1>;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly dbRuntimeRuns?: readonly import("@/lib/runtime/implementationRuntime/implementationRuntimeTypes").ImplementationRuntimeRunView[];
  readonly nowIso: string;
}): NonNullable<ReturnType<typeof parseCodeTaskExecutionRunsV1>> {
  const runs = input.runs ?? [];
  const existing = findDispatchableRunForCodeTask(runs, input.codeTaskId);
  if (existing) return runs;
  const target = resolveCodeTaskDispatchTarget({
    codeTaskId: input.codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!target) return runs;
  const runId = resolveCanonicalCodeTaskRunId({
    projectId: input.projectId,
    codeTaskId: input.codeTaskId,
    processTaskId: target.parentTaskId,
    existingRuns: runs,
    existingRuntimeRuns: input.dbRuntimeRuns,
  });
  const created = createCodeTaskExecutionRun({
    projectId: input.projectId,
    processTaskId: target.parentTaskId,
    workItemId: target.workItem.id,
    codeTaskId: input.codeTaskId,
    runs,
    nowIso: input.nowIso,
    runId,
  });
  return appendCodeTaskExecutionRun(runs, created);
}

/**
 * @deprecated legacy_runtime_deprecated — use dispatchNextExecutionUnitOnServer (P3-M71).
 * DB queued-run auto dispatch compatibility path only.
 */
export async function tryDispatchCurrentQueuedQuickRunAfterDbAdvance(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): Promise<ServerQuickRunContinuationResult> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  let latestPromptTimeline: readonly RequirementsPromptTimelineEntry[] | undefined;

  const appendSkipped = (
    outcome: ServerQuickRunContinuationOutcome,
    reason: string,
    extra?: Partial<ServerQuickRunContinuationResult>,
  ): ServerQuickRunContinuationResult => {
    const entry = buildQuickRunDbQueuedAutoDispatchTimelineEntry({
      projectId: pid,
      codeTaskId: run?.codeTaskId ?? job?.currentCodeTaskId ?? null,
      outcome: outcome === "execute_request_failed" ? "failed" : "skipped",
      reason,
      runState: run?.runtimeState ?? null,
      nowIso,
    });
    timelineEntries.push(entry);
    const promptTimeline = appendPromptTimeline(latestPromptTimeline, entry);
    return {
      ok: false,
      outcome,
      reason,
      timelineEntries,
      orchestrationPatch: { promptTimeline },
      ...extra,
    };
  };

  const projectRow = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  let requirementsState =
    parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  const quickRunRequirementsPrepared = prepareRequirementsStateForImplementationQuickRun({
    projectId: pid,
    requirementsState,
    nowIso,
  });
  const quickRunRequirementsPrepPatch = buildImplementationQuickRunRequirementsPrepPersistPatch({
    prepared: quickRunRequirementsPrepared,
  });
  if (Object.keys(quickRunRequirementsPrepPatch).length) {
    await persistTaskCursorOrchestrationToProject({
      projectId: pid,
      orchestrationPatch: quickRunRequirementsPrepPatch,
    });
  }
  requirementsState = quickRunRequirementsPrepared.requirementsState;
  latestPromptTimeline = requirementsState.promptTimeline;

  let bundle = await getImplementationRuntimeBundle(pid);
  const jobId = bundle.job?.id?.trim() ?? "";
  if (jobId && bundle.job?.status === "running") {
    const reconcileCodeTaskId =
      bundle.currentRun?.codeTaskId?.trim() ?? bundle.job.currentCodeTaskId?.trim() ?? "";
    if (reconcileCodeTaskId) {
      await reconcileImplementationRunBeforeDispatch({
        jobId,
        codeTaskId: reconcileCodeTaskId,
      });
    }
    await ensureQuickRunJobPointsAtQueuedRun({ projectId: pid, jobId });
    bundle = await getImplementationRuntimeBundle(pid);
  }

  const run = bundle.currentRun;
  const job = bundle.job;

  if (!job?.id || job.status !== "running" || !run || run.runtimeState !== "queued") {
    const codeTaskPlanForRecovery =
      ensureCodeTaskPlanWithFileBoundaries({
        plan: parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1),
        taskList: parseImplementationTaskListV1(requirementsState.implementationTaskListV1),
      }) ?? parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1);
    const runsForRecovery = parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
    const taskListForRecovery = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
    const nextUnit = resolveNextExecutionUnitFromRuntime({
      projectId: pid,
      requirementsState,
      codeTaskPlan: codeTaskPlanForRecovery,
      taskList: taskListForRecovery,
      runs: runsForRecovery,
      selectedCodeTaskIds: job?.selectedCodeTaskIds ?? null,
      dbBundle: bundle,
    });
    if (nextUnit && job?.status === "running" && job.id) {
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_next_unit_missing_db_run_recreated",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: nextUnit.unitId,
            codeTaskId: nextUnit.codeTaskId,
            processTaskId: nextUnit.processTaskId,
            branchGroup: nextUnit.branchGroup,
            baseBranch: nextUnit.baseBranch,
            workBranch: nextUnit.workBranch,
            order: nextUnit.order,
            reason: "next_execution_unit_without_db_run",
          },
          nowIso,
        }),
      );
      await ensureNextQuickRunDispatchRuntimeReady({
        projectId: pid,
        completedCodeTaskId: String(job.currentCodeTaskId ?? "").trim() || nextUnit.codeTaskId,
        nextCodeTaskId: nextUnit.codeTaskId,
      });
      bundle = await getImplementationRuntimeBundle(pid);
    }
  }

  let runAfterRecovery = bundle.currentRun;
  let jobAfterRecovery = bundle.job;

  for (let materializeAttempt = 0; materializeAttempt < 4; materializeAttempt += 1) {
    runAfterRecovery = bundle.currentRun;
    jobAfterRecovery = bundle.job;
    if (
      jobAfterRecovery?.id &&
      jobAfterRecovery.status === "running" &&
      runAfterRecovery &&
      runAfterRecovery.runtimeState === "queued"
    ) {
      break;
    }
    const nextUnit = resolveNextExecutionUnitFromRuntime({
      projectId: pid,
      requirementsState,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1),
      taskList: parseImplementationTaskListV1(requirementsState.implementationTaskListV1),
      runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [],
      dbBundle: bundle,
    });
    if (!nextUnit || jobAfterRecovery?.status !== "running" || !jobAfterRecovery.id) {
      break;
    }
    await ensureNextQuickRunDispatchRuntimeReady({
      projectId: pid,
      completedCodeTaskId: String(jobAfterRecovery.currentCodeTaskId ?? "").trim() || nextUnit.codeTaskId,
      nextCodeTaskId: nextUnit.codeTaskId,
    });
    bundle = await getImplementationRuntimeBundle(pid);
  }

  runAfterRecovery = bundle.currentRun;
  jobAfterRecovery = bundle.job;

  if (
    !jobAfterRecovery?.id ||
    jobAfterRecovery.status !== "running" ||
    !runAfterRecovery ||
    runAfterRecovery.runtimeState !== "queued"
  ) {
    const ctx = resolveQuickRunExecutionContext({
      projectId: pid,
      requirementsState,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1),
      taskList: parseImplementationTaskListV1(requirementsState.implementationTaskListV1),
      runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [],
      dbBundle: bundle,
    });
    if (ctx.next.status === "complete" || ctx.next.status === "empty_selection") {
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_no_next_unit_complete",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: { projectId: pid, status: ctx.next.status },
          nowIso,
        }),
      );
      return appendSkipped("no_next_task", "no_next_execution_unit", {
        diagnostics: {
          jobStatus: jobAfterRecovery?.status ?? job?.status ?? null,
          runState: runAfterRecovery?.runtimeState ?? run?.runtimeState ?? null,
        },
      });
    }
    if (ctx.next.status === "in_flight") {
      return appendSkipped("already_in_flight", "execution_unit_in_flight", {
        diagnostics: { unitId: ctx.next.unit.unitId, codeTaskId: ctx.next.unit.codeTaskId },
      });
    }
    return appendSkipped("skipped", "db_run_recreate_pending", {
      diagnostics: {
        jobStatus: jobAfterRecovery?.status ?? job?.status ?? null,
        runState: runAfterRecovery?.runtimeState ?? run?.runtimeState ?? null,
        nextCodeTaskId: ctx.next.status === "next" ? ctx.next.unit.codeTaskId : null,
      },
    });
  }

  const runQueued = runAfterRecovery;
  const jobRunning = jobAfterRecovery;

  const codeTaskPlanRaw = parseImplementationCodeTaskPlanV1(
    requirementsState.implementationCodeTaskPlanV1,
  );
  const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
  const codeTaskPlan =
    ensureCodeTaskPlanWithFileBoundaries({
      plan: codeTaskPlanRaw,
      taskList,
    }) ?? codeTaskPlanRaw;
  const workItems = requirementsState.cursorWorkItemsV1 ?? [];

  const queuedPlanTask =
    codeTaskPlan?.tasks.find((t) => t.codeTaskId.trim() === runQueued.codeTaskId.trim()) ?? null;
  const canonicalResolution = resolveCanonicalCodeTaskForQueuedRun({
    queuedCodeTaskId: runQueued.codeTaskId,
    codeTasks: codeTaskPlan?.tasks ?? [],
    currentCodeTaskTitle: queuedPlanTask?.title ?? null,
    branchGroup: parseCodeTaskBranchPlanV1(queuedPlanTask?.branchPlan)?.branchGroup ?? "data",
    workBranch: runQueued.branchName ?? queuedPlanTask?.branchPlan?.workBranch ?? null,
  });

  if (canonicalResolution.status === "blocked_mock_id" || canonicalResolution.status === "not_found") {
    const blockedEntry = buildQuickRunQueuedTargetBlockedTimelineEntry({
      projectId: pid,
      codeTaskId: dispatchCodeTaskId,
      reason:
        canonicalResolution.status === "not_found"
          ? "queued_code_task_id_not_in_current_plan"
          : canonicalResolution.reason,
      nowIso,
    });
    timelineEntries.push(blockedEntry);
    const promptTimeline = appendPromptTimeline(latestPromptTimeline, blockedEntry);
    return {
      ok: false,
      outcome: "queue_state_mismatch",
      reason:
        canonicalResolution.status === "not_found"
          ? "queued_code_task_id_not_in_current_plan"
          : canonicalResolution.reason,
      nextCodeTaskId: runQueued.codeTaskId,
      timelineEntries,
      orchestrationPatch: { promptTimeline },
    };
  }

  const dispatchCodeTaskId =
    canonicalResolution.status === "repaired"
      ? canonicalResolution.toCodeTaskId
      : canonicalResolution.codeTask.codeTaskId;

  if (canonicalResolution.status === "repaired") {
    const canonEntry = buildQuickRunQueuedTargetCanonicalizedTimelineEntry({
      projectId: pid,
      fromCodeTaskId: canonicalResolution.fromCodeTaskId,
      toCodeTaskId: canonicalResolution.toCodeTaskId,
      reason: canonicalResolution.reason,
      nowIso,
    });
    timelineEntries.push(canonEntry);
    latestPromptTimeline = appendPromptTimeline(latestPromptTimeline, canonEntry);
  }

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: dispatchCodeTaskId,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
  });
  if (!dispatchTarget) {
    return appendSkipped("queue_state_mismatch", "dispatch_target_not_found", {
      nextCodeTaskId: runQueued.codeTaskId,
    });
  }

  let quickRun: ImplementationQuickRunV1 | null = parseImplementationQuickRunV1(
    requirementsState.implementationQuickRunV1,
  );
  if (quickRun?.status !== "running") {
    const parentTaskIds = [
      ...new Set(
        (jobRunning.selectedCodeTaskIds ?? [])
          .map((codeTaskId) => {
            const row = codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId);
            return row?.parentTaskId?.trim() ?? "";
          })
          .filter(Boolean),
      ),
    ];
    quickRun = buildImplementationQuickRunStartedPatch({
      projectId: pid,
      currentTaskId: dispatchTarget.parentTaskId,
      selectedTaskIds: parentTaskIds.length ? parentTaskIds : [dispatchTarget.parentTaskId],
      nowIso,
    });
    await persistTaskCursorOrchestrationToProject({
      projectId: pid,
      orchestrationPatch: { implementationQuickRunV1: quickRun },
    });
    requirementsState = { ...requirementsState, implementationQuickRunV1: quickRun };
  }

  let runs = ensureJsonRunForQueuedCodeTask({
    projectId: pid,
    codeTaskId: dispatchCodeTaskId,
    runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1),
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
    nowIso,
  });

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

  if (runQueued.runtimeState !== "queued") {
    timelineEntries.push(
      buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry({
        projectId: pid,
        codeTaskId: dispatchCodeTaskId,
        reason: "run_already_in_flight",
        nowIso,
      }),
    );
    return appendSkipped("skipped", "run_already_in_flight", {
      nextCodeTaskId: dispatchCodeTaskId,
      diagnostics: { runState: runQueued.runtimeState },
    });
  }

  const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
    projectId: pid,
    dispatch: {
      codeTaskId: dispatchCodeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      triggerKey: `db_advance:${runQueued.id}:${nowIso}`,
    },
    baseOrchestrationPatch: { codeTaskExecutionRunsV1: runs },
    requirementsSlice: { ...requirementsState, codeTaskExecutionRunsV1: runs },
    context: readiness.context,
    cursorApiToken,
    nowIso,
  });

  if (!dispatchOutcome.dispatched) {
    const rawMessage = dispatchOutcome.message ?? "";
    if (isNonQueuedRuntimeDispatchError(rawMessage)) {
      timelineEntries.push(
        buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry({
          projectId: pid,
          codeTaskId: dispatchCodeTaskId,
          reason: "run_already_in_flight",
          nowIso,
        }),
      );
      return appendSkipped("skipped", "run_already_in_flight", {
        nextCodeTaskId: dispatchCodeTaskId,
        diagnostics: { runState: run.runtimeState, message: rawMessage },
      });
    }
    return appendSkipped(
      "execute_request_failed",
      rawMessage || "dispatch_failed",
      { nextCodeTaskId: dispatchCodeTaskId },
    );
  }

  const successEntry = buildQuickRunDbQueuedAutoDispatchTimelineEntry({
    projectId: pid,
    codeTaskId: dispatchCodeTaskId,
    outcome: "dispatched",
    runState: "cursor_running",
    nowIso,
  });
  timelineEntries.push(successEntry);
  const promptTimeline = appendPromptTimeline(latestPromptTimeline, successEntry);
  return {
    ok: true,
    outcome: "dispatched",
    nextTaskId: dispatchTarget.parentTaskId,
    nextCodeTaskId: runQueued.codeTaskId,
    reason: null,
    orchestrationPatch: mergeOrchestrationPersistPatches(dispatchOutcome.orchestrationPatch, {
      promptTimeline,
    }),
    timelineEntries,
  };
}

/** @deprecated legacy_runtime_deprecated — use dispatchNextExecutionUnitOnServer (P3-M71). */
export async function continueSelectedCodeTaskQueueAfterAutoGate(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId?: string | null;
  readonly sourceCommitSha?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
  /** DB persist 전 in-memory orchestration(방금 auto gate/verify patch)을 continuation 판정에 반영 */
  readonly requirementsOverlay?: Partial<RequirementsStateJson> | null;
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

  const appendDispatchFailed = (
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
      buildQuickRunNextDispatchFailedTimelineEntry({
        projectId: pid,
        completedTaskId,
        completedCodeTaskId: completedCodeTaskIdForTimeline,
        nextTaskId: extra?.nextTaskId ?? null,
        nextCodeTaskId: extra?.nextCodeTaskId ?? null,
        reason,
        retryable: true,
        diagnostics: extra?.diagnostics,
        nowIso,
      }),
    );
    return {
      ok: false,
      outcome: "execute_request_failed",
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
  let requirementsState =
    parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  if (input.requirementsOverlay && Object.keys(input.requirementsOverlay).length > 0) {
    requirementsState = mergeRequirementsStateJson(requirementsState, input.requirementsOverlay);
  }
  let taskCursor = parseTaskCursorExecutionV1(requirementsState.taskCursorExecutionV1);
  let runs = parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1);
  const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
  const workItems = requirementsState.cursorWorkItemsV1 ?? [];

  let bundle = await getImplementationRuntimeBundle(pid);

  const completedCodeTaskId =
    input.completedCodeTaskId?.trim() ||
    (taskCursor
      ? resolveCompletedCodeTaskId({
          execution: taskCursor,
          runs,
          dbBundle: bundle,
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

  if (bundle.job?.status === "running" && bundle.job.id) {
    await advanceJobWhenCompletedCodeTaskIsTerminal({
      projectId: pid,
      jobId: bundle.job.id,
      completedCodeTaskId,
    });
  }

  let bundleAfterAdvance = await getImplementationRuntimeBundle(pid);
  const executionCtx = resolveQuickRunExecutionContext({
    projectId: pid,
    requirementsState,
    codeTaskPlan,
    taskList,
    runs,
    dbBundle: bundleAfterAdvance,
  });
  let nextCodeTaskId =
    executionCtx.next.status === "next" ? executionCtx.next.unit.codeTaskId : null;

  if (!nextCodeTaskId?.trim()) {
    if (
      executionCtx.next.status === "in_flight" ||
      executionCtx.next.status === "blocked" ||
      shouldMarkQuickRunHasNextDispatch({
        projectId: pid,
        requirementsState: mergeRequirementsStateJson(requirementsState, executionCtx.orchestrationPatch),
        codeTaskPlan,
        taskList,
        runs,
        dbBundle: bundleAfterAdvance,
      })
    ) {
      timelineEntries.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_next_unit_resolved",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            status: executionCtx.next.status,
            selectedCount: executionCtx.selectedUnitIds.length,
            unitCount: executionCtx.units.length,
            remainingCount: countRemainingSelectedExecutionUnits({
              units: executionCtx.units,
              selectedUnitIds: executionCtx.selectedUnitIds,
            }),
            ...(executionCtx.next.status === "next"
              ? {
                  nextUnitId: executionCtx.next.unit.unitId,
                  nextCodeTaskId: executionCtx.next.unit.codeTaskId,
                }
              : {}),
          },
          nowIso,
        }),
      );
      const retryNext = resolveNextExecutionUnitFromRuntime({
        projectId: pid,
        requirementsState: mergeRequirementsStateJson(requirementsState, executionCtx.orchestrationPatch),
        codeTaskPlan,
        taskList,
        runs,
        dbBundle: bundleAfterAdvance,
      });
      if (retryNext) {
        await ensureNextQuickRunDispatchRuntimeReady({
          projectId: pid,
          completedCodeTaskId,
          nextCodeTaskId: retryNext.codeTaskId,
        });
        nextCodeTaskId = retryNext.codeTaskId;
      }
    }
  }

  if (!nextCodeTaskId?.trim()) {
    const quickRun = parseImplementationQuickRunV1(requirementsState.implementationQuickRunV1);
    const autoGate = parseImplementationAutoQualityGateV1(
      requirementsState.implementationAutoQualityGateV1,
    );
    const orchestrationPatch =
      taskCursor && quickRun
        ? buildQuickRunQueueExhaustedOrchestrationPatch({
            projectId: pid,
            taskCursor,
            completedCodeTaskId,
            runs,
            quickRun,
            autoGate,
            codeTaskPlan,
            taskList,
            cursorWorkItems: workItems,
            nowIso,
          }) ?? undefined
        : undefined;
    timelineEntries.push(
      buildQuickRunNextDispatchSkippedTimelineEntry({
        projectId: pid,
        completedTaskId,
        completedCodeTaskId,
        nextTaskId: null,
        nextCodeTaskId: null,
        reason: "no_next_task",
        diagnostics: {
          outcome: "no_next_task",
          completedCodeTaskId,
          selectedCodeTaskIds: bundleAfterAdvance.job?.selectedCodeTaskIds ?? [],
          jobCurrentCodeTaskId: bundleAfterAdvance.job?.currentCodeTaskId ?? null,
          currentRunState: bundleAfterAdvance.currentRun?.runtimeState ?? null,
          finalizedOrchestration: Boolean(orchestrationPatch),
        },
        nowIso,
      }),
    );
    return {
      ok: true,
      outcome: "no_next_task",
      nextCodeTaskId: null,
      reason: "no_next_task",
      orchestrationPatch,
      timelineEntries,
    };
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

  const runtimeReady = await ensureNextQuickRunDispatchRuntimeReady({
    projectId: pid,
    completedCodeTaskId,
    nextCodeTaskId,
  });
  bundleAfterAdvance = runtimeReady.bundle;
  if (runtimeReady.repaired) {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "runtime_queue_missing_run_repaired",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: nextCodeTaskId,
        fields: {
          nextCodeTaskId,
          runId: runtimeReady.runId,
          completedCodeTaskId,
        },
        nowIso,
      }),
    );
  }
  if (runtimeReady.runId) {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "quick_run_next_dispatch_run_resolved",
        orchestrationTraceGroup: "implementation_orchestration",
        routingDecision: dispatchTarget.parentTaskId,
        fields: {
          nextCodeTaskId,
          nextRunId: runtimeReady.runId,
          completedCodeTaskId,
        },
        nowIso,
      }),
    );
  }

  const split = detectCodeTaskRunIdentitySplit({
    codeTaskId: nextCodeTaskId,
    canonicalRunId: runtimeReady.runId ?? resolveCanonicalCodeTaskRunId({
      projectId: pid,
      codeTaskId: nextCodeTaskId,
      processTaskId: dispatchTarget.parentTaskId,
      existingRuns: runs,
      existingRuntimeRuns: bundleAfterAdvance.runs,
    }),
    existingRuns: runs,
    existingRuntimeRuns: bundleAfterAdvance.runs,
  });
  if (split) {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "runtime_run_identity_split_detected",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { ...split },
        nowIso,
      }),
    );
    logImplementationRuntimeStateDiagnostics([
      {
        code: "run_identity_split_detected",
        codeTaskId: split.codeTaskId,
        runId: split.canonicalRunId,
        message: split.observedRunIds.join(","),
      },
    ]);
  }

  const dbNextRunQueued =
    runtimeReady.ok &&
    bundleAfterAdvance.currentRun?.codeTaskId === nextCodeTaskId &&
    bundleAfterAdvance.currentRun.runtimeState === "queued";

  const autoGate = parseImplementationAutoQualityGateV1(
    requirementsState.implementationAutoQualityGateV1,
  );
  const repairedCursor = taskCursor
    ? resolveStaleTaskCursorAfterQualityGatePassed({
        taskCursor,
        completedTaskId,
        autoGateRaw: requirementsState.implementationAutoQualityGateV1,
        runs,
        completedCodeTaskId,
        nowIso,
      })
    : null;
  if (repairedCursor && taskCursor) {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "task_cursor_inflight_state_repaired",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: buildTaskCursorInflightRepairedTimelineFields({
          projectId: pid,
          taskId: taskCursor.taskId,
          priorStatus: taskCursor.status,
          reason: "auto_quality_gate_passed_stale_inflight",
        }),
        nowIso,
      }),
    );
    await persistTaskCursorOrchestrationToProject({
      projectId: pid,
      orchestrationPatch: { taskCursorExecutionV1: repairedCursor },
    });
    taskCursor = repairedCursor;
    requirementsState = { ...requirementsState, taskCursorExecutionV1: repairedCursor };
  }

  if (
    taskCursor &&
    shouldBlockQuickRunDispatchForInFlightTaskCursor({
      taskCursor,
      nextParentTaskId: dispatchTarget.parentTaskId,
      completedTaskId,
      completedCodeTaskId,
      runs,
      autoGate,
      promptTimeline: requirementsState.promptTimeline,
    }) &&
    !dbNextRunQueued
  ) {
    return appendSkipped("already_in_flight", QUICK_RUN_DISPATCH_REASON.already_in_flight, {
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

  runs = ensureJsonRunForQueuedCodeTask({
    projectId: pid,
    codeTaskId: nextCodeTaskId,
    runs,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
    dbRuntimeRuns: bundleAfterAdvance.runs,
    nowIso,
  });
  if (!findDispatchableRunForCodeTask(runs, nextCodeTaskId)) {
    return appendDispatchFailed(QUICK_RUN_DISPATCH_REASON.execution_record_upsert_failed, {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
    });
  }
  const runsBeforeUpsert = parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
  const hadDispatchableRun = Boolean(findDispatchableRunForCodeTask(runsBeforeUpsert, nextCodeTaskId));
  if (!hadDispatchableRun) {
    await persistTaskCursorOrchestrationToProject({
      projectId: pid,
      orchestrationPatch: { codeTaskExecutionRunsV1: runs },
    });
    requirementsState = { ...requirementsState, codeTaskExecutionRunsV1: runs };
  }

  const workBranch = buildCodeTaskWorkBranch(
    nextCodeTaskId,
    findLatestRunForCodeTask(runs, nextCodeTaskId)?.workBranch,
  );
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

  timelineEntries.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "quick_run_next_dispatch_execute_started",
      orchestrationTraceGroup: "implementation_orchestration",
      routingDecision: dispatchTarget.parentTaskId,
      fields: { nextCodeTaskId, nextTaskId: dispatchTarget.parentTaskId },
      nowIso,
    }),
  );

  const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
    projectId: pid,
    dispatch: {
      codeTaskId: nextCodeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      triggerKey: `${completedTaskId}:${input.sourceCommitSha ?? ""}:server:${nextCodeTaskId}`,
    },
    baseOrchestrationPatch: { codeTaskExecutionRunsV1: runs },
    requirementsSlice: { ...requirementsState, codeTaskExecutionRunsV1: runs },
    context: readiness.context,
    cursorApiToken,
    nowIso,
  });

  if (!dispatchOutcome.dispatched) {
    const rawMessage = dispatchOutcome.message ?? "";
    if (rawMessage.includes("DB Runtime queued run")) {
      const retryReady = await ensureNextQuickRunDispatchRuntimeReady({
        projectId: pid,
        completedCodeTaskId,
        nextCodeTaskId,
      });
      if (retryReady.ok) {
        timelineEntries.push(
          buildImplementationExecutionLogTimelineEntry({
            action: "quick_run_next_dispatch_queued_run_upserted",
            orchestrationTraceGroup: "implementation_orchestration",
            fields: {
              nextCodeTaskId,
              runId: retryReady.runId,
              created: true,
            },
            nowIso,
          }),
        );
        const retryOutcome = await dispatchQuickRunContinuationOnServer({
          projectId: pid,
          dispatch: {
            codeTaskId: nextCodeTaskId,
            parentTaskId: dispatchTarget.parentTaskId,
            workItemId: dispatchTarget.workItem.id,
            triggerKey: `${completedTaskId}:${input.sourceCommitSha ?? ""}:server-retry:${nextCodeTaskId}`,
          },
          baseOrchestrationPatch: { codeTaskExecutionRunsV1: runs },
          requirementsSlice: { ...requirementsState, codeTaskExecutionRunsV1: runs },
          context: readiness.context,
          cursorApiToken,
          nowIso,
        });
        if (retryOutcome.dispatched) {
          timelineEntries.push(
            buildImplementationExecutionLogTimelineEntry({
              action: "quick_run_next_dispatch_recovered",
              orchestrationTraceGroup: "implementation_orchestration",
              fields: { nextCodeTaskId, runId: retryReady.runId },
              nowIso,
            }),
          );
          timelineEntries.push(
            buildQuickRunNextDispatchExecutedTimelineEntry({
              projectId: pid,
              nextTaskId: dispatchTarget.parentTaskId,
              nextCodeTaskId,
              workBranch,
              nowIso,
            }),
          );
          const patch = retryOutcome.orchestrationPatch;
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
      }
    }
    const reason = rawMessage.includes("품질")
      ? "prompt_gate_failed"
      : rawMessage === QUICK_RUN_DISPATCH_REASON.execution_record_missing
        ? QUICK_RUN_DISPATCH_REASON.execution_record_missing
        : rawMessage === QUICK_RUN_DISPATCH_REASON.execution_record_upsert_failed
          ? QUICK_RUN_DISPATCH_REASON.execution_record_upsert_failed
          : QUICK_RUN_DISPATCH_REASON.dispatch_failed_retryable;
    if (
      reason === QUICK_RUN_DISPATCH_REASON.execution_record_missing ||
      reason === QUICK_RUN_DISPATCH_REASON.execution_record_upsert_failed ||
      reason === QUICK_RUN_DISPATCH_REASON.dispatch_failed_retryable
    ) {
      return appendDispatchFailed(reason, {
        nextTaskId: dispatchTarget.parentTaskId,
        nextCodeTaskId,
        diagnostics: { message: rawMessage },
      });
    }
    return appendSkipped(reason, rawMessage || reason, {
      nextTaskId: dispatchTarget.parentTaskId,
      nextCodeTaskId,
      diagnostics: { message: rawMessage },
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
