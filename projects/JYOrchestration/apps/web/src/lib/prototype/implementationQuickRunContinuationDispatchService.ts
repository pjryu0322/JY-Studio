import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { ExecutionSetupSourceGenerationContext } from "@/lib/prototype/executionSetupSourceGeneration";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import {
  buildTaskCursorApiStartedTimeline,
  buildTaskCursorOrchestrationPatch,
  buildTaskCursorRequestedTimeline,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  dispatchQueuedImplementationRuntimeRunWithCursor,
  prepareSelectedCodeTaskCursorExecution,
  resolveCodeTaskIdForDbRuntimeDispatch,
} from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { launchTaskCursorCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { patchTaskCursorExecution, TASK_CURSOR_FAILURE_MESSAGES } from "@/lib/prototype/taskCursorExecution";
import {
  buildRuntimeSyncAfterLaunchTimelineEntry,
  syncCursorLaunchToDbRuntime,
} from "@/lib/prototype/taskCursorRuntimeSyncAfterLaunch";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { mergeRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

export type QuickRunContinuationServerDispatchResult = Readonly<{
  readonly dispatched: boolean;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly message?: string;
}>;

/** verify-github advance 후 DB queued run이 있으면 서버에서 Cursor dispatch까지 수행한다. */
export async function dispatchQuickRunContinuationOnServer(input: {
  readonly projectId: string;
  readonly dispatch: QuickRunGithubAdvanceDispatch;
  readonly baseOrchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly requirementsSlice: RequirementsStateJson;
  readonly context: ExecutionSetupSourceGenerationContext;
  readonly cursorApiToken: string;
  readonly nowIso?: string;
}): Promise<QuickRunContinuationServerDispatchResult> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const state = mergeRequirementsStateJson(
    input.requirementsSlice,
    input.baseOrchestrationPatch as Partial<RequirementsStateJson>,
  );
  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  const workItems = state.cursorWorkItemsV1 ?? [];
  const context = input.context;

  const prep = prepareSelectedCodeTaskCursorExecution({
    projectId: pid,
    queueDispatch: {
      codeTaskId: input.dispatch.codeTaskId,
      parentTaskId: input.dispatch.parentTaskId,
      workItemId: input.dispatch.workItemId,
    },
    runs,
    codeTaskPlan,
    taskList,
    cursorWorkItems: workItems,
    targetRepository: context.targetRepository,
    baseBranch: context.baseBranch,
    allowedPathGlobs: context.allowedPathGlobs,
    codeTaskPromptContextMapV1: parseCodeTaskPromptContextMapV1(state.codeTaskPromptContextMapV1),
    existingTaskCursor: null,
    nowIso,
  });

  if (!prep.ok) {
    return {
      dispatched: false,
      orchestrationPatch: input.baseOrchestrationPatch,
      message: prep.message,
    };
  }

  const { prepared } = prep;
  const bundleForDispatch = await getImplementationRuntimeBundle(pid);
  const codeTaskIdForRuntime = resolveCodeTaskIdForDbRuntimeDispatch({
    requestedCodeTaskId: prepared.codeTaskId,
    bundle: bundleForDispatch,
  });

  const commitMessage = buildProviderWipCommitMessage(
    "cursor",
    `task ${prepared.parentTaskId}`,
    false,
    prepared.parentTaskId,
  );
  const body = prepared.requestBody;
  const apiRequest = {
    projectId: pid,
    taskId: prepared.parentTaskId,
    codeTaskId: body.codeTaskId,
    workItemIds: prepared.selectedWorkItems.map((w) => w.id),
    workItems: [...prepared.selectedWorkItems],
    cursorApiUrl: context.cursorApiUrl!,
    cursorApiToken: input.cursorApiToken,
    targetRepository: context.targetRepository,
    workspacePath: context.workspaceRoot,
    baseBranch: String(body.baseBranch ?? context.baseBranch).trim() || context.baseBranch,
    workBranch: body.workBranch,
    commitMessage,
    prompt: body.developerPrompt,
    allowedPathGlobs: context.allowedPathGlobs,
  };

  let execution = prepared.pendingExecution;
  const timeline = [
    ...(prepared.tupleTimeline ?? []),
    ...buildTaskCursorRequestedTimeline({ execution, nowIso }),
    buildTaskCursorApiStartedTimeline({ execution, nowIso }),
  ];

  try {
    const dbDispatched = await dispatchQueuedImplementationRuntimeRunWithCursor({
      projectId: pid,
      codeTaskId: codeTaskIdForRuntime,
      launch: async () => {
        const launch = await launchTaskCursorCloudAgent(apiRequest);
        if (!launch.ok) {
          throw new Error(launch.message ?? TASK_CURSOR_FAILURE_MESSAGES.unknown);
        }
        return {
          agentId: launch.agentId,
          branchName: execution.workBranch ?? null,
          targetRepository: context.targetRepository,
          baseBranch: String(body.baseBranch ?? context.baseBranch).trim() || context.baseBranch,
        };
      },
    });

    if (!dbDispatched) {
      return {
        dispatched: false,
        orchestrationPatch: mergeOrchestrationPersistPatches(input.baseOrchestrationPatch, {
          codeTaskExecutionRunsV1: runs.some((r) => r.runId === prepared.run.runId)
            ? runs.map((r) => (r.runId === prepared.run.runId ? prepared.run : r))
            : [...runs, prepared.run],
        }),
        message: "DB Runtime queued run이 없어 Cursor 실행을 시작할 수 없습니다. Runtime 상태를 새로고침한 뒤 다시 시도해 주세요.",
      };
    }

    const agentId = String(dbDispatched.currentRun?.cursorAgentId ?? "").trim();
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_running",
      cursorRunId: agentId || undefined,
      nowIso,
    });
    if (agentId) {
      await syncCursorLaunchToDbRuntime({
        projectId: pid,
        codeTaskId: codeTaskIdForRuntime,
        taskId: prepared.parentTaskId,
        execution,
        agentId,
        targetRepository: context.targetRepository,
        baseBranch: String(body.baseBranch ?? context.baseBranch).trim() || context.baseBranch,
        workBranch: execution.workBranch ?? null,
        now: new Date(nowIso),
      });
      timeline.push(
        buildRuntimeSyncAfterLaunchTimelineEntry({
          projectId: pid,
          taskId: prepared.parentTaskId,
          codeTaskId: codeTaskIdForRuntime,
          agentId,
          nowIso,
        }),
      );
    }

    const existingRuns =
      parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1)?.slice() ?? [];
    const runsWithPrepared = existingRuns.some((r) => r.runId === prepared.run.runId)
      ? existingRuns.map((r) => (r.runId === prepared.run.runId ? prepared.run : r))
      : [...existingRuns, prepared.run];

    const orchestrationPatch = buildTaskCursorOrchestrationPatch({
      execution,
      timelineEntries: timeline,
      cursorWorkItems: [...prepared.selectedWorkItems],
      codeTaskExecutionRunsV1: runsWithPrepared,
      activeCodeTaskId: prepared.codeTaskId,
      activeWorkItemId: prepared.workItem.id,
    });

    const mergedPatch = mergeOrchestrationPersistPatches(input.baseOrchestrationPatch, orchestrationPatch);
    await persistTaskCursorOrchestrationToProject({
      projectId: pid,
      orchestrationPatch: mergedPatch,
    });

    return {
      dispatched: true,
      orchestrationPatch: mergedPatch,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_failed",
      failureReason: "unknown",
      errorMessage: message,
      nowIso,
    });
    return {
      dispatched: false,
      orchestrationPatch: mergeOrchestrationPersistPatches(input.baseOrchestrationPatch, {
        taskCursorExecutionV1: execution,
      }),
      message,
    };
  }
}
