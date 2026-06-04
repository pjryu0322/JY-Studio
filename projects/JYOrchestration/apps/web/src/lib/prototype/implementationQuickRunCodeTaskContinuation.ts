import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import {
  isInFlightCodeTaskExecutionRunStatus,
  isQueuedCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { buildImplementationQuickRunCursorDispatchTimelineEntry } from "@/lib/prototype/implementationQuickRun";
import {
  deriveImplementationQuickRunStatus,
  parseImplementationQuickRunV1,
  syncImplementationQuickRunWithExecution,
  type ImplementationQuickRunV1,
} from "@/lib/prototype/implementationQuickRun";
import { buildPersistedActiveDispatchSnapshotPatch } from "@/lib/prototype/implementationRuntimePanelBridge";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function isAutoGatePassedForExecution(
  execution: TaskCursorExecutionV1,
  autoGate: ImplementationAutoQualityGateV1 | null | undefined,
): boolean {
  if (!autoGate || autoGate.status !== "passed" || autoGate.taskId !== execution.taskId) {
    return false;
  }
  const gateCommit = String(autoGate.sourceCommitSha ?? "").trim();
  const executionCommit = String(execution.commitSha ?? "").trim();
  if (!gateCommit || !executionCommit) return true;
  if (gateCommit === executionCommit) return true;
  return executionCommit.startsWith(gateCommit) || gateCommit.startsWith(executionCommit);
}

function resolveCompletedCodeTaskId(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly queue: CodeTaskExecutionQueueV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): string | null {
  const byCursor = input.runs.find(
    (r) =>
      r.processTaskId === input.execution.taskId &&
      r.cursorRunId &&
      r.cursorRunId === input.execution.cursorRunId,
  );
  if (byCursor?.codeTaskId) return byCursor.codeTaskId;

  if (input.queue) {
    for (let idx = 0; idx <= input.queue.currentIndex; idx += 1) {
      const codeTaskId = input.queue.selectedCodeTaskIds[idx];
      if (!codeTaskId) continue;
      const target = resolveCodeTaskDispatchTarget({
        codeTaskId,
        codeTaskPlan: input.codeTaskPlan,
        taskList: input.taskList,
        cursorWorkItems: input.cursorWorkItems,
      });
      if (target?.parentTaskId === input.execution.taskId) return codeTaskId;
    }
  }

  for (const codeTaskId of input.queue?.selectedCodeTaskIds ?? []) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (run?.processTaskId === input.execution.taskId) return codeTaskId;
  }
  return null;
}

export function resolveNextQuickRunCodeTaskId(input: {
  readonly queue: CodeTaskExecutionQueueV1 | null;
  readonly completedCodeTaskId: string | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): string | null {
  const job = input.dbBundle?.job;
  const currentRun = input.dbBundle?.currentRun;
  if (
    job?.status === "running" &&
    currentRun?.runtimeState === "queued" &&
    !currentRun.cursorAgentId
  ) {
    const nextId = String(job.currentCodeTaskId ?? currentRun.codeTaskId ?? "").trim();
    if (nextId && nextId !== input.completedCodeTaskId) return nextId;
  }

  const queue = input.queue;
  if (!queue || queue.status !== "running") return null;
  const completed = input.completedCodeTaskId?.trim() ?? "";
  const ids = queue.selectedCodeTaskIds;
  if (!ids.length) return null;

  const completedIdx = completed ? ids.indexOf(completed) : queue.currentIndex;
  const fromIdx = completedIdx >= 0 ? completedIdx + 1 : queue.currentIndex + 1;
  if (fromIdx >= ids.length) return null;
  return ids[fromIdx] ?? null;
}

export function buildQuickRunCodeTaskContinuationTriggerKey(input: {
  readonly autoGate: ImplementationAutoQualityGateV1;
  readonly nextCodeTaskId: string;
}): string {
  return `${input.autoGate.taskId}:${String(input.autoGate.sourceCommitSha ?? "").trim()}:next:${input.nextCodeTaskId.trim()}`;
}

export function shouldPlanQuickRunCodeTaskContinuationAfterAutoGate(input: {
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly queue?: CodeTaskExecutionQueueV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): boolean {
  const quickRun = input.quickRun;
  const execution = input.taskCursorExecution;
  const autoGate = input.autoGate ?? null;
  if (!quickRun || !execution) return false;
  if (
    deriveImplementationQuickRunStatus({
      quickRun,
      taskCursorExecution: execution,
      autoGate,
    }) !== "running"
  ) {
    return false;
  }
  if (!isAutoGatePassedForExecution(execution, autoGate)) return false;
  const completedCodeTaskId = resolveCompletedCodeTaskId({
    execution,
    runs: input.runs ?? [],
    queue: input.queue ?? null,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
    queue: input.queue ?? null,
    completedCodeTaskId,
    dbBundle: input.dbBundle,
  });
  return Boolean(nextCodeTaskId?.trim());
}

export type QuickRunCodeTaskContinuationPlan = Readonly<{
  readonly triggerKey: string;
  readonly nextCodeTaskId: string;
  readonly parentTaskId: string;
  readonly dispatch: CodeTaskQueueDispatchRef;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly timelineEntry: RequirementsPromptTimelineEntry;
}>;

export function planQuickRunCodeTaskContinuationAfterAutoGate(input: {
  readonly projectId: string;
  readonly quickRun: ImplementationQuickRunV1;
  readonly taskCursorExecution: TaskCursorExecutionV1;
  readonly autoGate: ImplementationAutoQualityGateV1;
  readonly queue: CodeTaskExecutionQueueV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly baseState: Record<string, unknown>;
  readonly developerPrompt?: string | null;
  readonly nowIso?: string;
}): QuickRunCodeTaskContinuationPlan | null {
  const pid = input.projectId.trim();
  const execution = input.taskCursorExecution;
  const autoGate = input.autoGate;
  if (!pid || !isAutoGatePassedForExecution(execution, autoGate)) return null;

  const nowIso = input.nowIso ?? new Date().toISOString();

  const completedCodeTaskId = resolveCompletedCodeTaskId({
    execution,
    runs: input.runs,
    queue: input.queue,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });

  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
    queue: input.queue,
    completedCodeTaskId,
    dbBundle: input.dbBundle,
  });
  if (!nextCodeTaskId?.trim()) return null;

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: nextCodeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!dispatchTarget) return null;

  const completedWorkItemId =
    findLatestRunForCodeTask(input.runs, completedCodeTaskId ?? "")?.workItemId ??
    resolveCodeTaskDispatchTarget({
      codeTaskId: completedCodeTaskId ?? "",
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      cursorWorkItems: input.cursorWorkItems,
    })?.workItem.id ??
    "";

  let runs =
    completedCodeTaskId && completedWorkItemId
      ? syncCodeTaskExecutionRunsFromTaskCursor({
          runs: input.runs,
          execution,
          codeTaskId: completedCodeTaskId,
          workItemId: completedWorkItemId,
          nowIso,
        })
      : [...input.runs];

  let nextRun = findLatestRunForCodeTask(runs, nextCodeTaskId);
  if (nextRun && isInFlightCodeTaskExecutionRunStatus(nextRun.status)) return null;
  if (!nextRun || !isQueuedCodeTaskExecutionRunStatus(nextRun.status)) {
    nextRun = createCodeTaskExecutionRun({
      projectId: pid,
      processTaskId: dispatchTarget.parentTaskId,
      workItemId: dispatchTarget.workItem.id,
      codeTaskId: nextCodeTaskId,
      developerPrompt: input.developerPrompt ?? undefined,
      runs,
      nowIso,
    });
    runs = appendCodeTaskExecutionRun(runs, nextRun);
  }

  const dispatch: CodeTaskQueueDispatchRef = {
    codeTaskId: nextCodeTaskId,
    parentTaskId: dispatchTarget.parentTaskId,
    workItemId: dispatchTarget.workItem.id,
  };

  const quickRun = syncImplementationQuickRunWithExecution({
    quickRun: input.quickRun,
    taskCursorExecution: execution,
    autoGate,
    nowIso,
  });

  const baseState = {
    ...input.baseState,
    implementationQuickRunV1: quickRun,
    codeTaskExecutionRunsV1: runs,
  };

  const orchestrationPatch: PrototypeExecutionOrchestrationPersistInput = {
    implementationQuickRunV1: quickRun,
    codeTaskExecutionRunsV1: runs,
    implementationRuntimeUiSnapshotV1: buildPersistedActiveDispatchSnapshotPatch({
      projectId: pid,
      dispatch: {
        codeTaskId: dispatch.codeTaskId,
        parentTaskId: dispatch.parentTaskId,
        workItemId: dispatch.workItemId,
        runId: nextRun.runId,
      },
      baseState,
      nowIso,
    }),
  };

  const timelineEntry = buildImplementationQuickRunCursorDispatchTimelineEntry({
    projectId: pid,
    taskId: dispatchTarget.parentTaskId,
    outcome: "executed",
    message: `quick_run_continue:${nextCodeTaskId}`,
    nowIso,
  });

  return {
    triggerKey: buildQuickRunCodeTaskContinuationTriggerKey({ autoGate, nextCodeTaskId }),
    nextCodeTaskId,
    parentTaskId: dispatchTarget.parentTaskId,
    dispatch,
    orchestrationPatch,
    timelineEntry,
  };
}
