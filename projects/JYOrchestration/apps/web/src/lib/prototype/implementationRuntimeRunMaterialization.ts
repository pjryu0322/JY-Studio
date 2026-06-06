import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findDispatchableRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { resolveCanonicalCodeTaskRunId } from "@/lib/prototype/codeTaskExecutionRunIdentity";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  advanceImplementationRuntimeJob,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import {
  getImplementationRuntimeBundle,
  type ImplementationRuntimeBundleView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { prisma } from "@/lib/prisma";
import { ensureQueuedRunForRedispatch } from "@/lib/runtime/implementationRuntime/implementationRuntimeRecovery";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import { selectNextRunnableCodeTaskRun, buildImplementationRuntimeQueueFromLegacy } from "@/lib/prototype/implementationRuntimeQueueModel";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";

export function materializeSelectedCodeTaskRuns(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly existingRuns: readonly CodeTaskExecutionRunV1[];
  readonly existingRuntimeRuns?: readonly ImplementationRuntimeBundleView["runs"];
  readonly nowIso: string;
}): Readonly<{
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly createdRunIds: readonly string[];
  readonly reusedRunIds: readonly string[];
  readonly executionOrder: readonly string[];
}> {
  const createdRunIds: string[] = [];
  const reusedRunIds: string[] = [];
  let runs = [...input.existingRuns];
  const executionOrder: string[] = [];

  for (const codeTaskId of input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean)) {
    const dispatchTarget = resolveCodeTaskDispatchTarget({
      codeTaskId,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      cursorWorkItems: input.cursorWorkItems,
    });
    if (!dispatchTarget) continue;

    const existing = findDispatchableRunForCodeTask(runs, codeTaskId);
    if (existing) {
      reusedRunIds.push(existing.runId);
      executionOrder.push(existing.runId);
      continue;
    }

    const runId = resolveCanonicalCodeTaskRunId({
      projectId: input.projectId,
      codeTaskId,
      processTaskId: dispatchTarget.parentTaskId,
      existingRuns: runs,
      existingRuntimeRuns: input.existingRuntimeRuns,
    });

    const created = createCodeTaskExecutionRun({
      projectId: input.projectId,
      processTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      codeTaskId,
      runs,
      nowIso: input.nowIso,
      runId,
    });
    runs = appendCodeTaskExecutionRun(runs, created);
    createdRunIds.push(created.runId);
    executionOrder.push(created.runId);
  }

  return { runs, createdRunIds, reusedRunIds, executionOrder };
}

export async function ensureQueuedRuntimeRunForCodeTask(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly processTaskId?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
}): Promise<Readonly<{
  readonly runId: string;
  readonly created: boolean;
  readonly repaired: boolean;
  readonly bundle: ImplementationRuntimeBundleView;
}>> {
  void input.processTaskId;
  void input.runId;
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  let bundle = await getImplementationRuntimeBundle(pid);
  const job = bundle.job;
  if (!job?.id || job.status !== "running") {
    throw new Error("active_implementation_runtime_job_missing");
  }

  let created = false;
  let repaired = false;
  const current = bundle.currentRun;

  if (current?.codeTaskId === codeTaskId && current.runtimeState === "queued") {
    return { runId: current.id, created: false, repaired: false, bundle };
  }

  const existingQueued = bundle.runs.find(
    (r) => r.codeTaskId === codeTaskId && r.runtimeState === "queued",
  );
  if (existingQueued) {
    if (job.currentCodeTaskId !== codeTaskId) {
      await prisma.implementationExecutionJob.update({
        where: { id: job.id },
        data: { currentCodeTaskId: codeTaskId, updatedAt: new Date() },
      });
      repaired = true;
    }
    bundle = await getImplementationRuntimeBundle(pid);
    const refreshed = bundle.currentRun;
    if (refreshed?.codeTaskId === codeTaskId && refreshed.runtimeState === "queued") {
      return { runId: refreshed.id, created: false, repaired, bundle };
    }
  }

  if (
    current &&
    current.codeTaskId !== codeTaskId &&
    isTerminalRuntimeState(current.runtimeState) &&
    job.currentCodeTaskId === current.codeTaskId
  ) {
    try {
      bundle = await advanceImplementationRuntimeJob({ projectId: pid, jobId: job.id });
      const after = bundle.currentRun;
      if (after?.codeTaskId === codeTaskId && after.runtimeState === "queued") {
        return { runId: after.id, created: true, repaired: true, bundle };
      }
    } catch {
      // fall through to explicit queued run create
    }
  }

  const run = await ensureQueuedRunForRedispatch({
    projectId: pid,
    jobId: job.id,
    codeTaskId,
  });
  created = true;
  repaired = true;
  bundle = await getImplementationRuntimeBundle(pid);
  return { runId: run.id, created, repaired, bundle };
}

export async function ensureNextQuickRunDispatchRuntimeReady(input: {
  readonly projectId: string;
  readonly completedCodeTaskId: string;
  readonly nextCodeTaskId: string;
}): Promise<Readonly<{
  readonly ok: boolean;
  readonly bundle: ImplementationRuntimeBundleView;
  readonly repaired: boolean;
  readonly runId: string | null;
}>> {
  const pid = input.projectId.trim();
  const completedCodeTaskId = input.completedCodeTaskId.trim();
  const nextCodeTaskId = input.nextCodeTaskId.trim();

  let bundle = await getImplementationRuntimeBundle(pid);
  const job = bundle.job;
  if (!job?.id || job.status !== "running") {
    return { ok: false, bundle, repaired: false, runId: null };
  }

  const current = bundle.currentRun;
  if (current?.codeTaskId === nextCodeTaskId && current.runtimeState === "queued") {
    return { ok: true, bundle, repaired: false, runId: current.id };
  }

  let repaired = false;
  if (
    current?.codeTaskId === completedCodeTaskId &&
    isTerminalRuntimeState(current.runtimeState)
  ) {
    try {
      bundle = await advanceImplementationRuntimeJob({ projectId: pid, jobId: job.id });
      repaired = true;
      const after = bundle.currentRun;
      if (after?.codeTaskId === nextCodeTaskId && after.runtimeState === "queued") {
        return { ok: true, bundle, repaired, runId: after.id };
      }
    } catch {
      // continue with upsert
    }
  }

  try {
    const ensured = await ensureQueuedRuntimeRunForCodeTask({
      projectId: pid,
      codeTaskId: nextCodeTaskId,
    });
    return {
      ok: ensured.bundle.currentRun?.codeTaskId === nextCodeTaskId,
      bundle: ensured.bundle,
      repaired: repaired || ensured.repaired,
      runId: ensured.runId,
    };
  } catch {
    return { ok: false, bundle, repaired, runId: null };
  }
}

export function resolveFirstRunnableRunIdFromMaterialized(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): string | null {
  const queue = buildImplementationRuntimeQueueFromLegacy({
    queue: startCodeTaskExecutionQueue({
      projectId: "",
      selectedCodeTaskIds: input.selectedCodeTaskIds,
    }),
    runs: input.runs,
  });
  return selectNextRunnableCodeTaskRun({ queue, runs: input.runs })?.runId ?? null;
}
