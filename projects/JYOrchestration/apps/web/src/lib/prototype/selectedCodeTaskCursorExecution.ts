import { buildCodeTaskCursorExecutionRequest } from "@/lib/prototype/codeTaskExecutionRequest";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import { CODE_TASK_IN_FLIGHT_USER_MESSAGE } from "@/lib/prototype/codeTaskExecutionRunView";
import { checkCodeTaskDependencyReady } from "@/lib/prototype/codeTaskDependencyResolver";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { refineCursorWorkItemsForImplementation } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  formatWorkItemPreflightBlockedMessage,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { patchTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";

export type CodeTaskQueueDispatchRef = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItemId: string;
}>;

export type PreparedSelectedCodeTaskCursorExecution = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItem: CursorWorkItem;
  readonly run: CodeTaskExecutionRunV1;
  readonly pendingExecution: TaskCursorExecutionV1;
  readonly requestBody: ReturnType<typeof buildCodeTaskCursorExecutionRequest>["requestBody"];
  readonly selectedWorkItems: readonly CursorWorkItem[];
}>;

export type PrepareSelectedCodeTaskCursorExecutionResult =
  | Readonly<{ readonly ok: true; readonly prepared: PreparedSelectedCodeTaskCursorExecution }>
  | Readonly<{
      readonly ok: false;
      readonly outcome: "blocked" | "no_op";
      readonly message: string;
    }>;

export function isSelectedCodeTaskRunInFlight(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  return Boolean(run && isInFlightCodeTaskExecutionRunStatus(run.status));
}

/** queueDispatch 기준 CodeTask 실행 준비. legacy WIP selector를 사용하지 않는다. */
export function prepareSelectedCodeTaskCursorExecution(input: {
  readonly projectId: string;
  readonly queueDispatch: CodeTaskQueueDispatchRef;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs: readonly string[];
  readonly existingTaskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): PrepareSelectedCodeTaskCursorExecutionResult {
  const run = findLatestRunForCodeTask(input.runs, input.queueDispatch.codeTaskId);
  if (!run) {
    return { ok: false, outcome: "blocked", message: "CodeTask 실행 기록을 찾을 수 없습니다." };
  }
  if (input.codeTaskPlan) {
    const dependencyCheck = checkCodeTaskDependencyReady({
      codeTaskId: input.queueDispatch.codeTaskId,
      codeTaskPlan: input.codeTaskPlan,
      runs: input.runs ?? [],
    });
    if (dependencyCheck.status !== "ready") {
      return {
        ok: false,
        outcome: "blocked",
        message: dependencyCheck.message ?? "선행 CodeTask가 완료되지 않아 실행할 수 없습니다.",
      };
    }
  }
  if (isSelectedCodeTaskRunInFlight(run)) {
    return { ok: false, outcome: "no_op", message: CODE_TASK_IN_FLIGHT_USER_MESSAGE };
  }
  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: input.queueDispatch.codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!dispatchTarget) {
    return {
      ok: false,
      outcome: "blocked",
      message: `CodeTask ${input.queueDispatch.codeTaskId}에 연결된 WorkItem을 찾을 수 없습니다.`,
    };
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  let selectedWorkItems: CursorWorkItem[] = [dispatchTarget.workItem];
  if (input.taskList) {
    const refinement = refineCursorWorkItemsForImplementation({
      projectId: input.projectId,
      taskList: input.taskList,
      workItems: selectedWorkItems,
      selectedTaskId: dispatchTarget.parentTaskId,
      allowedPathGlobs: input.allowedPathGlobs,
      targetRepository: input.targetRepository,
      nowIso,
    });
    selectedWorkItems = [...refinement.workItems];
  }
  if (!selectedWorkItems.length) {
    return { ok: false, outcome: "blocked", message: "WorkItem 보정 후 실행 가능한 항목이 없습니다." };
  }
  const preflight = runWorkItemPreflightBatch({
    workItems: selectedWorkItems,
    allowedPathGlobs: input.allowedPathGlobs,
  });
  if (preflight.status === "failed") {
    return {
      ok: false,
      outcome: "blocked",
      message: formatWorkItemPreflightBlockedMessage(preflight),
    };
  }
  selectedWorkItems = selectedWorkItems.map((item) => ({
    ...item,
    refinementStatus: "preflight_passed" as const,
  }));
  const built = buildCodeTaskCursorExecutionRequest({
    projectId: input.projectId,
    run,
    codeTask: dispatchTarget.codeTask,
    parentTask: dispatchTarget.parentTask,
    workItem: selectedWorkItems[0]!,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    existingTaskCursor: input.existingTaskCursor,
    nowIso,
  });
  const pendingExecution = patchTaskCursorExecution(built.taskCursorRequest, {
    status: "cursor_requested",
    cursorRunId: undefined,
    nowIso,
  });
  return {
    ok: true,
    prepared: {
      codeTaskId: dispatchTarget.codeTask.codeTaskId,
      parentTaskId: dispatchTarget.parentTaskId,
      workItem: selectedWorkItems[0]!,
      run: built.run,
      pendingExecution,
      requestBody: built.requestBody,
      selectedWorkItems,
    },
  };
}
