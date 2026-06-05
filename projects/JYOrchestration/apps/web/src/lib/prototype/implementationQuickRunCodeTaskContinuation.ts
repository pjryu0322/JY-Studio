import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  updateCodeTaskExecutionRun,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { syncCodeTaskExecutionRunsFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunTaskCursorAdapter";
import {
  isInFlightCodeTaskExecutionRunStatus,
  isQueuedCodeTaskExecutionRunStatus,
  isTerminalCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
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
import { patchTaskCursorExecution, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { resolveNextQuickRunCodeTaskId } from "@/lib/prototype/implementationSelectedCodeTaskSequence";

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

export function resolveCompletedCodeTaskId(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
}): string | null {
  const queue = resolveEffectiveCodeTaskExecutionQueue({ dbBundle: input.dbBundle });
  const byCursor = input.runs.find(
    (r) =>
      r.processTaskId === input.execution.taskId &&
      r.cursorRunId &&
      r.cursorRunId === input.execution.cursorRunId,
  );
  if (byCursor?.codeTaskId) return byCursor.codeTaskId;

  const matchParentTask = (codeTaskId: string): boolean => {
    const fromPlan = input.codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId);
    if (fromPlan?.parentTaskId === input.execution.taskId) return true;
    const target = resolveCodeTaskDispatchTarget({
      codeTaskId,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      cursorWorkItems: input.cursorWorkItems,
    });
    return target?.parentTaskId === input.execution.taskId;
  };

  const jobCurrent = input.dbBundle?.job?.currentCodeTaskId?.trim();
  if (
    jobCurrent &&
    matchParentTask(jobCurrent) &&
    (input.execution.status === "scm_pending" ||
      input.execution.status === "github_verified" ||
      input.execution.status === "review_pending" ||
      input.execution.status === "security_pending")
  ) {
    return jobCurrent;
  }

  const dbCodeTaskCandidates = new Set<string>();
  const cur = input.dbBundle?.currentRun;
  if (cur?.codeTaskId?.trim() && isTerminalRuntimeState(cur.runtimeState)) {
    dbCodeTaskCandidates.add(cur.codeTaskId.trim());
  }
  for (const run of input.dbBundle?.runs ?? []) {
    const id = run.codeTaskId?.trim();
    if (id && isTerminalRuntimeState(run.runtimeState)) {
      dbCodeTaskCandidates.add(id);
    }
  }
  if (jobCurrent) dbCodeTaskCandidates.add(jobCurrent);

  for (const codeTaskId of dbCodeTaskCandidates) {
    if (!matchParentTask(codeTaskId)) continue;
    const jsonRun = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (
      jsonRun?.cursorRunId &&
      input.execution.cursorRunId &&
      jsonRun.cursorRunId === input.execution.cursorRunId
    ) {
      return codeTaskId;
    }
    if (
      jsonRun &&
      isTerminalCodeTaskExecutionRunStatus(jsonRun.status) &&
      (input.execution.status === "scm_pending" ||
        input.execution.status === "github_verified" ||
        input.execution.status === "completed")
    ) {
      return codeTaskId;
    }
  }

  if (queue) {
    for (let idx = 0; idx <= queue.currentIndex; idx += 1) {
      const codeTaskId = queue.selectedCodeTaskIds[idx];
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

  for (const codeTaskId of queue?.selectedCodeTaskIds ?? []) {
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    if (run?.processTaskId === input.execution.taskId) return codeTaskId;
  }

  const terminalForParent = [...input.runs]
    .filter(
      (r) =>
        r.processTaskId === input.execution.taskId &&
        r.codeTaskId &&
        isTerminalCodeTaskExecutionRunStatus(r.status),
    )
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  if (terminalForParent[0]?.codeTaskId) return terminalForParent[0].codeTaskId;

  return null;
}

export { resolveNextQuickRunCodeTaskId } from "@/lib/prototype/implementationSelectedCodeTaskSequence";

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
    dbBundle: input.dbBundle,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
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
    dbBundle: input.dbBundle,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });

  const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
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

  const promptText = input.developerPrompt?.trim();
  if (promptText && nextRun.status !== "prompt_ready") {
    runs = updateCodeTaskExecutionRun(runs, nextRun.runId, {
      developerPrompt: promptText,
      status: "prompt_ready",
      updatedAt: nowIso,
    });
    nextRun = findLatestRunForCodeTask(runs, nextCodeTaskId)!;
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

/** 선택 CodeTask 큐의 마지막 항목까지 끝났을 때 JSON 실행 상태를 terminal로 맞춘다. */
export function buildQuickRunQueueExhaustedOrchestrationPatch(input: {
  readonly projectId: string;
  readonly taskCursor: TaskCursorExecutionV1;
  readonly completedCodeTaskId: string;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly nowIso?: string;
}): PrototypeExecutionOrchestrationPersistInput | null {
  const pid = input.projectId.trim();
  const completedCodeTaskId = input.completedCodeTaskId.trim();
  const quickRun = input.quickRun ?? null;
  if (!pid || !completedCodeTaskId || !quickRun) return null;

  const nowIso = input.nowIso ?? new Date().toISOString();
  const autoGate = input.autoGate ?? null;
  let execution = input.taskCursor;

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: completedCodeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  const workItemId =
    findLatestRunForCodeTask(input.runs, completedCodeTaskId)?.workItemId ??
    dispatchTarget?.workItem.id ??
    "";

  let runs =
    workItemId && isAutoGatePassedForExecution(execution, autoGate)
      ? syncCodeTaskExecutionRunsFromTaskCursor({
          runs: input.runs,
          execution,
          codeTaskId: completedCodeTaskId,
          workItemId,
          nowIso,
        })
      : [...input.runs];

  if (
    isAutoGatePassedForExecution(execution, autoGate) &&
    execution.status !== "scm_pending"
  ) {
    execution = patchTaskCursorExecution(execution, {
      status: "scm_pending",
      errorMessage: undefined,
      failureReason: undefined,
      nowIso,
    });
    if (workItemId) {
      runs = syncCodeTaskExecutionRunsFromTaskCursor({
        runs,
        execution,
        codeTaskId: completedCodeTaskId,
        workItemId,
        nowIso,
      });
    }
  }

  const syncedQuickRun = syncImplementationQuickRunWithExecution({
    quickRun,
    taskCursorExecution: execution,
    autoGate,
    nowIso,
  });

  return {
    implementationQuickRunV1: syncedQuickRun,
    codeTaskExecutionRunsV1: runs,
    taskCursorExecutionV1: execution,
  };
}
