import {
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  buildExecutionUnitStartedPatch,
  resolveQuickRunExecutionContextFromPersisted,
} from "@/lib/prototype/implementationExecutionRuntime";
import {
  ensureExecutionUnitDbRunHistory,
  resolveExecutionUnitRunHistory,
} from "@/lib/prototype/implementationExecutionUnitRunHistory";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { patchImplementationExecutionUnitInState } from "@/lib/prototype/implementationExecutionUnitStore";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { ServerQuickRunContinuationResult } from "@/lib/prototype/serverQuickRunContinuationService";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { prisma } from "@/lib/prisma";

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

export type DispatchNextExecutionUnitOutcomeV1 =
  | "dispatched"
  | "no_next_task"
  | "in_flight"
  | "empty_selection"
  | "blocked"
  | "execute_request_failed"
  | "run_identity_mismatch";

export type DispatchNextExecutionUnitResultV1 = Readonly<{
  readonly ok: boolean;
  readonly outcome: DispatchNextExecutionUnitOutcomeV1;
  readonly nextUnit?: ImplementationExecutionUnitV1 | null;
  readonly nextCodeTaskId?: string | null;
  readonly reason?: string | null;
  readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

export function mapDispatchNextExecutionUnitToServerResult(
  input: DispatchNextExecutionUnitResultV1,
): ServerQuickRunContinuationResult {
  const outcomeMap: Record<
    DispatchNextExecutionUnitOutcomeV1,
    ServerQuickRunContinuationResult["outcome"]
  > = {
    dispatched: "dispatched",
    no_next_task: "no_next_task",
    in_flight: "already_in_flight",
    empty_selection: "skipped",
    blocked: "skipped",
    execute_request_failed: "execute_request_failed",
    run_identity_mismatch: "queue_state_mismatch",
  };
  return {
    ok: input.ok,
    outcome: outcomeMap[input.outcome],
    nextCodeTaskId: input.nextCodeTaskId ?? null,
    reason: input.reason ?? null,
    orchestrationPatch: input.orchestrationPatch,
    timelineEntries: input.timelineEntries,
  };
}

/** P3-M71 — direct ExecutionUnit scheduler (does not call legacy continuation). */
export async function dispatchNextExecutionUnitOnServer(input: {
  readonly projectId: string;
  readonly completedCodeTaskId?: string | null;
  readonly completedTaskId?: string | null;
  readonly sourceCommitSha?: string | null;
  readonly requirementsOverlay?: Partial<RequirementsStateJson> | null;
  readonly nowIso?: string;
}): Promise<DispatchNextExecutionUnitResultV1> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  if (!pid) {
    return {
      ok: false,
      outcome: "execute_request_failed",
      reason: "missing_project_id",
      timelineEntries,
    };
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  let requirementsState = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  if (input.requirementsOverlay && Object.keys(input.requirementsOverlay).length > 0) {
    requirementsState = mergeRequirementsStateJson(requirementsState, input.requirementsOverlay);
  }

  const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
  const codeTaskPlanRaw = parseImplementationCodeTaskPlanV1(requirementsState.implementationCodeTaskPlanV1);
  const codeTaskPlan =
    ensureCodeTaskPlanWithFileBoundaries({ plan: codeTaskPlanRaw, taskList }) ?? codeTaskPlanRaw;
  let runs = parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
  const workItems = requirementsState.cursorWorkItemsV1 ?? [];

  const bundle = await getImplementationRuntimeBundle(pid);

  const ctx = resolveQuickRunExecutionContextFromPersisted({
    projectId: pid,
    requirementsState,
    codeTaskPlan,
    taskList,
    runs,
    dbBundle: bundle,
  });

  requirementsState = mergeRequirementsStateJson(requirementsState, ctx.orchestrationPatch);
  timelineEntries.push(...ctx.timeline);

  timelineEntries.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_execution_next_unit_resolved",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        status: ctx.next.status,
        selectedCount: ctx.selectedUnitIds.length,
        unitCount: ctx.units.length,
      },
      nowIso,
    }),
  );

  if (ctx.next.status === "empty_selection") {
    return {
      ok: false,
      outcome: "empty_selection",
      reason: "no_execution_units_selected",
      orchestrationPatch: { promptTimeline: timelineEntries },
      timelineEntries,
    };
  }

  if (ctx.next.status === "complete") {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_completed",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { projectId: pid, selectedCount: ctx.selectedUnitIds.length },
        nowIso,
      }),
    );
    return {
      ok: true,
      outcome: "no_next_task",
      reason: "all_selected_units_terminal",
      orchestrationPatch: { promptTimeline: timelineEntries },
      timelineEntries,
    };
  }

  if (ctx.next.status === "in_flight") {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_in_flight_noop",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          unitId: ctx.next.unit.unitId,
          codeTaskId: ctx.next.unit.codeTaskId,
          status: ctx.next.unit.status,
        },
        nowIso,
      }),
    );
    return {
      ok: false,
      outcome: "in_flight",
      nextUnit: ctx.next.unit,
      nextCodeTaskId: ctx.next.unit.codeTaskId,
      reason: "execution_unit_in_flight",
      orchestrationPatch: { promptTimeline: timelineEntries },
      timelineEntries,
    };
  }

  if (ctx.next.status === "blocked") {
    const blockedPatch = patchImplementationExecutionUnitInState({
      state: requirementsState,
      projectId: pid,
      unitId: ctx.next.unit.unitId,
      patch: {
        status: "blocked",
        errorCode: ctx.next.reason,
        errorMessage: ctx.next.reason,
      },
      reason: "implementation_execution_unit_blocked",
      nowIso,
    });
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_unit_failed",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          unitId: ctx.next.unit.unitId,
          reason: ctx.next.reason,
          status: "blocked",
        },
        nowIso,
      }),
    );
    return {
      ok: false,
      outcome: "blocked",
      nextUnit: ctx.next.unit,
      nextCodeTaskId: ctx.next.unit.codeTaskId,
      reason: ctx.next.reason,
      orchestrationPatch: mergeOrchestrationPersistPatches(blockedPatch.orchestrationPatch, {
        promptTimeline: timelineEntries,
      }),
      timelineEntries,
    };
  }

  const unit = ctx.next.unit;
  const history = resolveExecutionUnitRunHistory({
    projectId: pid,
    unit,
    runs,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
    existingRuntimeRuns: bundle.runs,
    nowIso,
  });
  timelineEntries.push(...history.timeline);

  if (history.status === "blocked") {
    return {
      ok: false,
      outcome: "execute_request_failed",
      nextUnit: unit,
      nextCodeTaskId: unit.codeTaskId,
      reason: history.reason,
      orchestrationPatch: { promptTimeline: timelineEntries },
      timelineEntries,
    };
  }
  if (history.status === "mismatch") {
    return {
      ok: false,
      outcome: "run_identity_mismatch",
      nextUnit: unit,
      nextCodeTaskId: unit.codeTaskId,
      reason: history.reason,
      orchestrationPatch: { promptTimeline: timelineEntries },
      timelineEntries,
    };
  }

  runs = [...history.runs];
  const dbHistory = await ensureExecutionUnitDbRunHistory({
    projectId: pid,
    unit,
    completedCodeTaskId: input.completedCodeTaskId,
  });
  if (!dbHistory.ok) {
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_unit_run_history_created",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          codeTaskId: unit.codeTaskId,
          dbRunReady: false,
          note: "db_run_history_pending",
        },
        nowIso,
      }),
    );
  }

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: unit.codeTaskId,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
  });
  if (!dispatchTarget) {
    return {
      ok: false,
      outcome: "execute_request_failed",
      nextUnit: unit,
      nextCodeTaskId: unit.codeTaskId,
      reason: "dispatch_target_not_found",
      orchestrationPatch: { promptTimeline: timelineEntries, codeTaskExecutionRunsV1: runs },
      timelineEntries,
    };
  }

  const stateWithRuns = mergeRequirementsStateJson(requirementsState, {
    codeTaskExecutionRunsV1: runs,
  });
  const started = buildExecutionUnitStartedPatch({
    state: stateWithRuns,
    projectId: pid,
    unitId: unit.unitId,
    runId: history.runId,
    nowIso,
  });
  timelineEntries.push(...started.timeline);

  let orchestrationPatch = mergeOrchestrationPersistPatches(
    ctx.orchestrationPatch,
    { codeTaskExecutionRunsV1: runs },
    started.orchestrationPatch,
  );

  await persistTaskCursorOrchestrationToProject({
    projectId: pid,
    orchestrationPatch: orchestrationPatch as Record<string, unknown>,
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
    return {
      ok: false,
      outcome: "execute_request_failed",
      nextUnit: unit,
      nextCodeTaskId: unit.codeTaskId,
      reason: "execution_setup_not_ready",
      orchestrationPatch: mergeOrchestrationPersistPatches(orchestrationPatch, {
        promptTimeline: timelineEntries,
      }),
      timelineEntries,
    };
  }

  const completedTaskId = input.completedTaskId?.trim() || unit.processTaskId;
  const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
    projectId: pid,
    dispatch: {
      codeTaskId: unit.codeTaskId,
      parentTaskId: unit.processTaskId,
      workItemId: dispatchTarget.workItem.id,
      triggerKey: `execution_unit:${unit.unitId}:${input.sourceCommitSha ?? ""}:${nowIso}`,
    },
    baseOrchestrationPatch: orchestrationPatch,
    requirementsSlice: mergeRequirementsStateJson(stateWithRuns, orchestrationPatch as Partial<RequirementsStateJson>),
    context: readiness.context,
    cursorApiToken,
    nowIso,
  });

  orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, dispatchOutcome.orchestrationPatch);

  timelineEntries.push(
    buildImplementationExecutionLogTimelineEntry({
      action: dispatchOutcome.dispatched
        ? "implementation_execution_next_unit_dispatched"
        : "implementation_execution_unit_failed",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        unitId: unit.unitId,
        codeTaskId: unit.codeTaskId,
        processTaskId: unit.processTaskId,
        workBranch: unit.workBranch,
        order: unit.order,
        completedTaskId,
        runId: history.runId,
        dbRunId: dbHistory.runId,
        dispatched: dispatchOutcome.dispatched,
        ...(dispatchOutcome.message ? { message: dispatchOutcome.message.slice(0, 200) } : {}),
      },
      nowIso,
    }),
  );

  const promptTimeline = appendPromptTimelineEntries(
    mergeRequirementsStateJson(requirementsState, orchestrationPatch as Partial<RequirementsStateJson>)
      .promptTimeline ?? [],
    timelineEntries,
  );

  return {
    ok: dispatchOutcome.dispatched,
    outcome: dispatchOutcome.dispatched ? "dispatched" : "execute_request_failed",
    nextUnit: unit,
    nextCodeTaskId: unit.codeTaskId,
    reason: dispatchOutcome.dispatched ? null : dispatchOutcome.message ?? "dispatch_failed",
    orchestrationPatch: { ...orchestrationPatch, promptTimeline },
    timelineEntries,
  };
}
