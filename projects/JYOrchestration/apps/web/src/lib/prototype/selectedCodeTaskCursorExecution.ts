import {
  tryBuildCodeTaskCursorExecutionRequest,
  type BuildCodeTaskCursorExecutionRequestResult,
} from "@/lib/prototype/codeTaskExecutionRequest";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  findDispatchableRunForCodeTask,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import { CODE_TASK_IN_FLIGHT_USER_MESSAGE } from "@/lib/prototype/codeTaskExecutionRunView";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { refineCursorWorkItemsForImplementation } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  formatWorkItemPreflightBlockedMessage,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import {
  getCodeTaskPromptContextFromMap,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { patchTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { dispatchNextQueuedImplementationRuntimeRun } from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

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
  readonly requestBody: Extract<
    BuildCodeTaskCursorExecutionRequestResult,
    { ok: true }
  >["built"]["requestBody"];
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
  if (!run) return false;
  if (run.status === "queued" || run.status === "prompt_ready") return false;
  return isInFlightCodeTaskExecutionRunStatus(run.status);
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
  readonly codeTaskPromptContextMapV1?: CodeTaskPromptContextMapV1 | null;
  readonly existingTaskCursor?: TaskCursorExecutionV1 | null;
  readonly nowIso?: string;
}): PrepareSelectedCodeTaskCursorExecutionResult {
  const run = findDispatchableRunForCodeTask(input.runs, input.queueDispatch.codeTaskId);
  if (!run) {
    return { ok: false, outcome: "blocked", message: "CodeTask 실행 기록을 찾을 수 없습니다." };
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
  const promptContext = getCodeTaskPromptContextFromMap(
    input.codeTaskPromptContextMapV1,
    input.queueDispatch.codeTaskId,
  );
  const builtResult = tryBuildCodeTaskCursorExecutionRequest({
    projectId: input.projectId,
    run,
    codeTask: dispatchTarget.codeTask,
    parentTask: dispatchTarget.parentTask,
    promptContext,
    workItem: selectedWorkItems[0]!,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    existingTaskCursor: input.existingTaskCursor,
    nowIso,
  });
  if (!builtResult.ok) {
    return { ok: false, outcome: "blocked", message: builtResult.message };
  }
  const built = builtResult.built;
  const pendingExecution = patchTaskCursorExecution(built.taskCursorRequest, {
    status: "prompt_ready",
    cursorRunId: undefined,
    failureReason: undefined,
    errorMessage: undefined,
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

/** DB Runtime queued Run → Cursor launch → cursor_running (없으면 null) */
export function resolveCodeTaskIdForDbRuntimeDispatch(input: {
  readonly requestedCodeTaskId: string;
  readonly bundle: ImplementationRuntimeBundleView;
}): string {
  const requested = input.requestedCodeTaskId.trim();
  const job = input.bundle.job;
  const run = input.bundle.currentRun;
  if (!requested || !job || job.status !== "running" || !run) {
    return requested;
  }
  if (run.codeTaskId === requested) {
    return requested;
  }
  if (job.currentCodeTaskId === run.codeTaskId) {
    return run.codeTaskId;
  }
  return requested;
}

export async function dispatchQueuedImplementationRuntimeRunWithCursor(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly launch: () => Promise<{
    readonly agentId: string;
    readonly branchName?: string | null;
    readonly targetRepository?: ProjectTargetRepository | string | null;
    readonly baseBranch?: string | null;
  }>;
}): Promise<ImplementationRuntimeBundleView | null> {
  const pid = input.projectId.trim();
  if (!pid) return null;

  const bundle = await getImplementationRuntimeBundle(pid);
  const job = bundle.job;
  const run = bundle.currentRun;
  const codeTaskId = resolveCodeTaskIdForDbRuntimeDispatch({
    requestedCodeTaskId: input.codeTaskId.trim(),
    bundle,
  });
  if (!codeTaskId) return null;

  if (!job || job.status !== "running" || !run || run.codeTaskId !== codeTaskId) {
    return null;
  }
  if (run.runtimeState !== "queued") {
    return null;
  }

  return dispatchNextQueuedImplementationRuntimeRun({
    projectId: pid,
    jobId: job.id,
    buildCursorRequest: async (ctx) => {
      if (ctx.codeTaskId !== codeTaskId) {
        throw new Error(`codeTaskId mismatch: ${ctx.codeTaskId}`);
      }
      return input.launch();
    },
  });
}
