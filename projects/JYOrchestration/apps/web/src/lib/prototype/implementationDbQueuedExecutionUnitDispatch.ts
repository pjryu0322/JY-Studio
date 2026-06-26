import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  dispatchNextExecutionUnitOnServer,
  mapDispatchNextExecutionUnitToServerResult,
} from "@/lib/prototype/implementationExecutionUnitDispatchService";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import {
  buildImplementationQuickRunRequirementsPrepPersistPatch,
  prepareRequirementsStateForImplementationQuickRun,
} from "@/lib/prototype/implementationQuickRunStartService";
import { resolveNextExecutionUnitFromRuntime } from "@/lib/prototype/implementationQuickRunQueue";
import {
  ensureNextQuickRunDispatchRuntimeReady,
  ensureQuickRunJobPointsAtQueuedRun,
} from "@/lib/prototype/implementationRuntimeRunMaterialization";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import { reconcileImplementationRunBeforeDispatch } from "@/lib/runtime/implementationRuntime/implementationRuntimeRunDispatch";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { prisma } from "@/lib/prisma";
import type { ServerQuickRunContinuationResult } from "@/lib/prototype/serverQuickRunContinuationTypes";
import {
  buildImplementationDatabaseRequiredBlockedTimelineEntry,
  evaluateImplementationDatabaseRequiredExecutionBlock,
  IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
} from "@/lib/prototype/implementationPlanningDatabaseExecutionGuard";

/** Maps db-queued advance input to execution-unit dispatch (actorUserId forwarded when present). */
export function mapDbQueuedAdvanceToNextExecutionUnitDispatchInput(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly projectId: string;
  readonly nowIso?: string;
  readonly actorUserId?: string;
}> {
  const projectId = input.projectId.trim();
  const actorUserId = String(input.actorUserId ?? "").trim();
  return {
    projectId,
    ...(input.nowIso ? { nowIso: input.nowIso } : {}),
    ...(actorUserId ? { actorUserId } : {}),
  };
}

/**
 * P3-M71/E — materialize DB queued runtime (if needed) then dispatch via ExecutionUnit scheduler.
 * Replaces legacy `dispatchQuickRunContinuationOnServer` in db-queued auto-advance paths.
 */
export async function dispatchDbQueuedAutoAdvanceOnServer(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
  readonly nowIso?: string;
}): Promise<ServerQuickRunContinuationResult> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  const projectRow = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  let requirementsState = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
  const databaseBlock = evaluateImplementationDatabaseRequiredExecutionBlock({
    planningHandoffForImplementationV1: requirementsState.planningHandoffForImplementationV1 ?? null,
  });
  if (databaseBlock.blocked) {
    timelineEntries.push(
      buildImplementationDatabaseRequiredBlockedTimelineEntry({
        projectId: pid,
        handoff: requirementsState.planningHandoffForImplementationV1 ?? null,
        nowIso,
      }),
    );
    return {
      ok: false,
      outcome: "skipped",
      reason: IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
      timelineEntries,
      orchestrationPatch: { promptTimeline: timelineEntries },
    };
  }
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

  const job = bundle.job;
  const run = bundle.currentRun;

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

  for (let materializeAttempt = 0; materializeAttempt < 4; materializeAttempt += 1) {
    const jobAfter = bundle.job;
    const runAfter = bundle.currentRun;
    if (
      jobAfter?.id &&
      jobAfter.status === "running" &&
      runAfter &&
      runAfter.runtimeState === "queued"
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
    if (!nextUnit || jobAfter?.status !== "running" || !jobAfter.id) {
      break;
    }
    await ensureNextQuickRunDispatchRuntimeReady({
      projectId: pid,
      completedCodeTaskId: String(jobAfter.currentCodeTaskId ?? "").trim() || nextUnit.codeTaskId,
      nextCodeTaskId: nextUnit.codeTaskId,
    });
    bundle = await getImplementationRuntimeBundle(pid);
  }

  const direct = await dispatchNextExecutionUnitOnServer(
    mapDbQueuedAdvanceToNextExecutionUnitDispatchInput({
      projectId: pid,
      actorUserId: input.actorUserId,
      nowIso,
    }),
  );

  const mapped = mapDispatchNextExecutionUnitToServerResult(direct);
  const mergedTimeline = appendPromptTimelineEntries(
    requirementsState.promptTimeline ?? [],
    [...timelineEntries, ...direct.timelineEntries],
  );
  return {
    ...mapped,
    timelineEntries: [...timelineEntries, ...direct.timelineEntries],
    orchestrationPatch: mergeOrchestrationPersistPatches(direct.orchestrationPatch ?? {}, {
      promptTimeline: mergedTimeline,
    }),
  };
}
