import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findDispatchableRunForCodeTask,
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { resolveCanonicalCodeTaskRunId } from "@/lib/prototype/codeTaskExecutionRunIdentity";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type ExecutionUnitRunHistoryResultV1 =
  | Readonly<{
      readonly status: "ok";
      readonly runs: readonly CodeTaskExecutionRunV1[];
      readonly runId: string;
      readonly created: boolean;
      readonly attached: boolean;
      readonly timeline: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly status: "blocked";
      readonly reason: string;
      readonly timeline: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly status: "mismatch";
      readonly reason: string;
      readonly timeline: readonly RequirementsPromptTimelineEntry[];
    }>;

function runMatchesExecutionUnitTuple(
  run: CodeTaskExecutionRunV1,
  unit: ImplementationExecutionUnitV1,
): boolean {
  const processTaskId = unit.processTaskId.trim();
  const workBranch = unit.workBranch.trim();
  const runProcess = String(run.processTaskId ?? "").trim();
  const runBranch = String(run.workBranch ?? "").trim();
  if (processTaskId && runProcess && runProcess !== processTaskId) return false;
  if (workBranch && runBranch && runBranch !== workBranch) return false;
  return true;
}

/** P3-M71 — JSON run history attach/create from ExecutionUnit tuple (not DB bundle SoT). */
export function resolveExecutionUnitRunHistory(input: {
  readonly projectId: string;
  readonly unit: ImplementationExecutionUnitV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly existingRuntimeRuns?: readonly ImplementationRuntimeBundleView["runs"];
  readonly nowIso?: string;
}): ExecutionUnitRunHistoryResultV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const unit = input.unit;
  const processTaskId = unit.processTaskId.trim();
  const workBranch = unit.workBranch.trim();
  const codeTaskId = unit.codeTaskId.trim();

  if (!processTaskId || !workBranch || !codeTaskId) {
    return {
      status: "blocked",
      reason: "execution_unit_tuple_incomplete",
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_run_identity_mismatch",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: unit.unitId,
            codeTaskId,
            reason: "missing_process_task_or_work_branch",
            processTaskId: processTaskId || null,
            workBranch: workBranch || null,
          },
          nowIso,
        }),
      ],
    };
  }

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems ?? [],
  });
  if (!dispatchTarget) {
    return {
      status: "blocked",
      reason: "dispatch_target_not_found",
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_run_identity_mismatch",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: { projectId: pid, unitId: unit.unitId, codeTaskId, reason: "dispatch_target_not_found" },
          nowIso,
        }),
      ],
    };
  }

  if (dispatchTarget.parentTaskId.trim() !== processTaskId) {
    return {
      status: "mismatch",
      reason: "process_task_id_mismatch",
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_run_identity_mismatch",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: unit.unitId,
            codeTaskId,
            expectedProcessTaskId: processTaskId,
            planProcessTaskId: dispatchTarget.parentTaskId,
          },
          nowIso,
        }),
      ],
    };
  }

  let runs = [...input.runs];
  const latest = findLatestRunForCodeTask(runs, codeTaskId);
  const dispatchable = findDispatchableRunForCodeTask(runs, codeTaskId);

  if (latest && !runMatchesExecutionUnitTuple(latest, unit)) {
    return {
      status: "mismatch",
      reason: "run_history_identity_mismatch",
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_run_identity_mismatch",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: unit.unitId,
            codeTaskId,
            runId: latest.runId,
            unitWorkBranch: workBranch,
            runWorkBranch: latest.workBranch ?? null,
            unitProcessTaskId: processTaskId,
            runProcessTaskId: latest.processTaskId ?? null,
          },
          nowIso,
        }),
      ],
    };
  }

  if (dispatchable) {
    return {
      status: "ok",
      runs,
      runId: dispatchable.runId,
      created: false,
      attached: true,
      timeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_run_history_attached",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: unit.unitId,
            codeTaskId,
            processTaskId,
            workBranch,
            runId: dispatchable.runId,
          },
          nowIso,
        }),
      ],
    };
  }

  const runId = resolveCanonicalCodeTaskRunId({
    projectId: pid,
    codeTaskId,
    processTaskId,
    existingRuns: runs,
    existingRuntimeRuns: input.existingRuntimeRuns,
  });

  const createdBase = createCodeTaskExecutionRun({
    projectId: pid,
    processTaskId,
    workItemId: dispatchTarget.workItem.id,
    codeTaskId,
    runs,
    nowIso,
    runId,
  });
  const created: CodeTaskExecutionRunV1 = { ...createdBase, workBranch };
  runs = appendCodeTaskExecutionRun(runs, created);

  return {
    status: "ok",
    runs,
    runId: created.runId,
    created: true,
    attached: false,
    timeline: [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_unit_run_history_created",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          unitId: unit.unitId,
          codeTaskId,
          processTaskId,
          workBranch,
          branchGroup: unit.branchGroup,
          order: unit.order,
          runId: created.runId,
        },
        nowIso,
      }),
    ],
  };
}

export async function ensureExecutionUnitDbRunHistory(input: {
  readonly projectId: string;
  readonly unit: ImplementationExecutionUnitV1;
  readonly completedCodeTaskId?: string | null;
}): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly runId: string | null;
    readonly repaired: boolean;
  }>
> {
  const { ensureQueuedRuntimeRunForCodeTask } = await import(
    "@/lib/prototype/implementationRuntimeRunMaterialization"
  );
  const processTaskId = input.unit.processTaskId.trim();
  const workBranch = input.unit.workBranch.trim();
  if (!processTaskId || !workBranch) {
    return { ok: false, runId: null, repaired: false };
  }
  try {
    const ensured = await ensureQueuedRuntimeRunForCodeTask({
      projectId: input.projectId,
      codeTaskId: input.unit.codeTaskId,
      processTaskId,
    });
    return { ok: true, runId: ensured.runId, repaired: ensured.repaired };
  } catch {
    return { ok: false, runId: null, repaired: false };
  }
}
