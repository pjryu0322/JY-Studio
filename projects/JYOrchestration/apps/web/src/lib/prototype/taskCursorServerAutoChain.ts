import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { resolveTaskCursorPollWorkItems } from "@/lib/prototype/taskCursorClientPollLoop";
import { createQueuedTaskCursorExecutionJob } from "@/lib/prototype/taskCursorExecutionJobRepository";
import {
  buildTaskCursorExecutionRequest,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { resolveTaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import { parseImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { buildTaskCursorJobLifecycleTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

export async function enqueueNextTaskCursorJobAfterTerminal(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly requirementsState: RequirementsStateJson;
  readonly now?: Date;
}): Promise<
  Readonly<{
    readonly enqueuedJobId?: string;
    readonly nextTaskId?: string;
    readonly orchestrationPatch?: ReturnType<typeof buildTaskCursorOrchestrationPatch>;
  }>
> {
  const board = buildImplementationExecutionBoardFromRequirementsState({
    projectId: input.projectId,
    orchestration: input.requirementsState,
  });
  if (!board) return {};

  const decision = resolveTaskCursorAutoChainDecision({
    board,
    taskCursorExecution: input.execution,
    autoGate: parseImplementationAutoQualityGateV1(input.requirementsState.implementationAutoQualityGateV1),
    autoQualityGateInFlight: false,
  });
  if (decision.kind === "none") return {};

  const nextTaskId =
    decision.kind === "start"
      ? decision.taskId
      : decision.kind === "continue"
        ? decision.toTaskId
        : decision.toTaskId;
  if (!nextTaskId) return {};

  const workItems = resolveTaskCursorPollWorkItems(
    { ...input.execution, taskId: nextTaskId, workItemIds: [] },
    input.requirementsState.cursorWorkItemsV1 ?? [],
  ).filter((item) => item.taskId === nextTaskId);
  if (!workItems.length) return {};

  const nowIso = (input.now ?? new Date()).toISOString();
  const pendingExecution = buildTaskCursorExecutionRequest({
    projectId: input.projectId,
    taskId: nextTaskId,
    workItemIds: workItems.map((item) => item.id),
    workItems,
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    allowedPathGlobs: [],
    nowIso,
  });

  const job = await createQueuedTaskCursorExecutionJob({
    projectId: input.projectId,
    execution: pendingExecution,
    workItems,
    history: input.requirementsState.taskCursorExecutionHistoryV1 ?? null,
    now: input.now,
  });

  const timelineEntry = buildTaskCursorJobLifecycleTimelineEntry({
    action: "task_cursor_job_created",
    projectId: input.projectId,
    taskId: nextTaskId,
    jobId: job.id,
    status: "queued",
    message: `auto-chain from ${input.execution.taskId}`,
    nowIso,
  });

  return {
    enqueuedJobId: job.id,
    nextTaskId,
    orchestrationPatch: buildTaskCursorOrchestrationPatch({
      execution: pendingExecution,
      history: input.requirementsState.taskCursorExecutionHistoryV1 ?? null,
      timelineEntries: [timelineEntry],
      cursorWorkItems: input.requirementsState.cursorWorkItemsV1 ?? [],
      existingCodeTaskExecutionFeedback:
        input.requirementsState.implementationCodeTaskExecutionFeedbackV1 ?? null,
      codeTaskQualityGate: input.requirementsState.implementationCodeTaskQualityGateV1 ?? null,
    }),
  };
}

export function parseRequirementsStateForTaskCursorWorker(raw: unknown): RequirementsStateJson {
  return parseRequirementsStateJson(raw);
}
