import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { ExecutionSetupSourceGenerationContext } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { buildExecutionUnitStartedPatch } from "@/lib/prototype/implementationExecutionRuntime";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { patchImplementationExecutionUnitInState } from "@/lib/prototype/implementationExecutionUnitStore";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import {
  buildTaskCursorApiStartedTimeline,
  buildTaskCursorOrchestrationPatch,
  buildTaskCursorRequestedTimeline,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseCodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { prepareSelectedCodeTaskCursorExecution } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { launchTaskCursorCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { patchTaskCursorExecution, TASK_CURSOR_FAILURE_MESSAGES } from "@/lib/prototype/taskCursorExecution";
import {
  buildRuntimeSyncAfterLaunchTimelineEntry,
  syncCursorLaunchToDbRuntime,
} from "@/lib/prototype/taskCursorRuntimeSyncAfterLaunch";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type DispatchExecutionUnitWithCursorResultV1 =
  | Readonly<{
      readonly ok: true;
      readonly execution: TaskCursorExecutionV1;
      readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
      readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      readonly ok: false;
      readonly reason: string;
      readonly userSafeMessage: string;
      readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
      readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
    }>;

function validateExecutionUnitDispatchTuple(unit: ImplementationExecutionUnitV1): string | null {
  if (!unit.unitId.trim()) return "missing_unit_id";
  if (!unit.codeTaskId.trim()) return "missing_code_task_id";
  if (!unit.processTaskId.trim()) return "missing_process_task_id";
  if (!unit.workBranch.trim()) return "missing_work_branch";
  if (!unit.baseBranch.trim()) return "missing_base_branch";
  return null;
}

/** P3-M72 — Cursor launch from ExecutionUnit tuple (no DB queued-run gate). */
export async function dispatchExecutionUnitWithCursor(input: {
  readonly projectId: string;
  readonly unit: ImplementationExecutionUnitV1;
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly executionContext: ExecutionSetupSourceGenerationContext;
  readonly cursorApiToken: string;
  readonly runId: string;
  readonly triggerKey: string;
  readonly nowIso: string;
}): Promise<DispatchExecutionUnitWithCursorResultV1> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso;
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];
  const unit = input.unit;

  const tupleError = validateExecutionUnitDispatchTuple(unit);
  if (tupleError) {
    return {
      ok: false,
      reason: tupleError,
      userSafeMessage: "실행 단위 정보가 불완전해 Cursor 실행을 시작할 수 없습니다.",
      timelineEntries: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_failed",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: { projectId: pid, unitId: unit.unitId, reason: tupleError },
          nowIso,
        }),
      ],
    };
  }

  const runs = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
  const runFromId = runs.find((r) => r.runId === input.runId.trim()) ?? null;
  const run =
    runFromId ?? findLatestRunForCodeTask(runs, unit.codeTaskId);
  if (!run) {
    return {
      ok: false,
      reason: "execution_record_missing",
      userSafeMessage: "실행 기록이 없어 Cursor 실행을 시작할 수 없습니다.",
      timelineEntries,
    };
  }

  const dispatchTarget = resolveCodeTaskDispatchTarget({
    codeTaskId: unit.codeTaskId,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
  });
  if (!dispatchTarget) {
    return {
      ok: false,
      reason: "dispatch_target_not_found",
      userSafeMessage: "CodeTask에 연결된 WorkItem을 찾을 수 없습니다.",
      timelineEntries,
    };
  }

  const prep = prepareSelectedCodeTaskCursorExecution({
    projectId: pid,
    queueDispatch: {
      codeTaskId: unit.codeTaskId,
      parentTaskId: unit.processTaskId,
      workItemId: dispatchTarget.workItem.id,
    },
    runs,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    cursorWorkItems: input.cursorWorkItems,
    targetRepository: input.executionContext.targetRepository,
    baseBranch: unit.baseBranch.trim() || input.executionContext.baseBranch,
    allowedPathGlobs: input.executionContext.allowedPathGlobs,
    codeTaskPromptContextMapV1: parseCodeTaskPromptContextMapV1(
      input.requirementsState.codeTaskPromptContextMapV1,
    ),
    existingTaskCursor: null,
    nowIso,
  });

  if (!prep.ok) {
    const failedPatch = patchImplementationExecutionUnitInState({
      state: input.requirementsState,
      projectId: pid,
      unitId: unit.unitId,
      patch: {
        status: "failed",
        failedAt: nowIso,
        retryable: true,
        errorCode: prep.outcome,
        errorMessage: prep.message,
      },
      reason: "implementation_execution_unit_failed",
      nowIso,
    });
    return {
      ok: false,
      reason: prep.outcome,
      userSafeMessage: prep.message,
      orchestrationPatch: failedPatch.orchestrationPatch,
      timelineEntries: [
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_execution_unit_failed",
          orchestrationTraceGroup: "implementation_orchestration",
          fields: {
            projectId: pid,
            unitId: unit.unitId,
            codeTaskId: unit.codeTaskId,
            reason: prep.message.slice(0, 200),
          },
          nowIso,
        }),
      ],
    };
  }

  const { prepared } = prep;
  const baseBranch =
    unit.baseBranch.trim() ||
    String(prepared.requestBody.baseBranch ?? input.executionContext.baseBranch).trim() ||
    input.executionContext.baseBranch;
  const workBranch = unit.workBranch.trim() || prepared.requestBody.workBranch;

  const commitMessage = buildProviderWipCommitMessage(
    "cursor",
    `task ${prepared.parentTaskId}`,
    false,
    prepared.parentTaskId,
  );

  let execution = patchTaskCursorExecution(prepared.pendingExecution, {
    workBranch,
    baseBranch,
    nowIso,
  });

  timelineEntries.push(
    ...(prepared.tupleTimeline ?? []),
    ...buildTaskCursorRequestedTimeline({ execution, nowIso }),
    buildTaskCursorApiStartedTimeline({ execution, nowIso }),
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_execution_unit_cursor_launch_requested",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        unitId: unit.unitId,
        codeTaskId: unit.codeTaskId,
        processTaskId: unit.processTaskId,
        workBranch,
        triggerKey: input.triggerKey,
        runId: input.runId,
      },
      nowIso,
    }),
  );

  try {
    const launch = await launchTaskCursorCloudAgent({
      projectId: pid,
      taskId: prepared.parentTaskId,
      codeTaskId: prepared.requestBody.codeTaskId,
      workItemIds: prepared.selectedWorkItems.map((w) => w.id),
      workItems: [...prepared.selectedWorkItems],
      cursorApiUrl: input.executionContext.cursorApiUrl!,
      cursorApiToken: input.cursorApiToken,
      targetRepository: input.executionContext.targetRepository,
      workspacePath: input.executionContext.workspaceRoot,
      baseBranch,
      workBranch,
      commitMessage,
      prompt: prepared.requestBody.developerPrompt,
      allowedPathGlobs: input.executionContext.allowedPathGlobs,
    });

    if (!launch.ok) {
      throw new Error(launch.message ?? TASK_CURSOR_FAILURE_MESSAGES.unknown);
    }

    const agentId = String(launch.agentId ?? "").trim();
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_running",
      cursorRunId: agentId || undefined,
      nowIso,
    });

    if (agentId) {
      try {
        await syncCursorLaunchToDbRuntime({
          projectId: pid,
          codeTaskId: unit.codeTaskId,
          taskId: prepared.parentTaskId,
          execution,
          agentId,
          targetRepository: input.executionContext.targetRepository,
          baseBranch,
          workBranch,
          now: new Date(nowIso),
        });
        timelineEntries.push(
          buildRuntimeSyncAfterLaunchTimelineEntry({
            projectId: pid,
            taskId: prepared.parentTaskId,
            codeTaskId: unit.codeTaskId,
            agentId,
            nowIso,
          }),
        );
      } catch {
        timelineEntries.push(
          buildImplementationExecutionLogTimelineEntry({
            action: "implementation_execution_unit_run_history_attached",
            orchestrationTraceGroup: "implementation_orchestration",
            fields: {
              projectId: pid,
              unitId: unit.unitId,
              note: "db_runtime_audit_sync_skipped",
            },
            nowIso,
          }),
        );
      }
    }

    const runsWithPrepared = upsertRunInList(runs, prepared.run);
    let mergedState = mergeRequirementsStateJson(input.requirementsState, {
      codeTaskExecutionRunsV1: runsWithPrepared,
    });

    const started = buildExecutionUnitStartedPatch({
      state: mergedState,
      projectId: pid,
      unitId: unit.unitId,
      runId: input.runId,
      nowIso,
    });
    timelineEntries.push(...started.timeline);

    mergedState = mergeRequirementsStateJson(mergedState, started.orchestrationPatch as Partial<RequirementsStateJson>);

    const orchestrationPatch = buildTaskCursorOrchestrationPatch({
      execution,
      timelineEntries,
      cursorWorkItems: [...prepared.selectedWorkItems],
      codeTaskExecutionRunsV1: runsWithPrepared,
      activeCodeTaskId: prepared.codeTaskId,
      activeWorkItemId: prepared.workItem.id,
    });

    const mergedPatch = mergeOrchestrationPersistPatches(
      started.orchestrationPatch,
      orchestrationPatch,
    );

    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_next_unit_dispatched",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          unitId: unit.unitId,
          codeTaskId: unit.codeTaskId,
          agentId: agentId || null,
        },
        nowIso,
      }),
    );

    return {
      ok: true,
      execution,
      orchestrationPatch: mergeOrchestrationPersistPatches(mergedPatch, {
        promptTimeline: timelineEntries,
      }),
      timelineEntries,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    execution = patchTaskCursorExecution(execution, {
      status: "cursor_failed",
      failureReason: "unknown",
      errorMessage: message,
      nowIso,
    });
    const failedPatch = patchImplementationExecutionUnitInState({
      state: input.requirementsState,
      projectId: pid,
      unitId: unit.unitId,
      patch: {
        status: "failed",
        failedAt: nowIso,
        retryable: true,
        errorCode: "cursor_launch_failed",
        errorMessage: message,
      },
      reason: "implementation_execution_unit_failed",
      nowIso,
    });
    timelineEntries.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_unit_failed",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          unitId: unit.unitId,
          codeTaskId: unit.codeTaskId,
          reason: message.slice(0, 200),
        },
        nowIso,
      }),
    );
    return {
      ok: false,
      reason: "cursor_launch_failed",
      userSafeMessage: message || "Cursor 실행을 시작하지 못했습니다.",
      orchestrationPatch: mergeOrchestrationPersistPatches(failedPatch.orchestrationPatch, {
        taskCursorExecutionV1: execution,
      }),
      timelineEntries,
    };
  }
}

function upsertRunInList(
  runs: readonly CodeTaskExecutionRunV1[],
  run: CodeTaskExecutionRunV1,
): CodeTaskExecutionRunV1[] {
  return runs.some((r) => r.runId === run.runId)
    ? runs.map((r) => (r.runId === run.runId ? run : r))
    : [...runs, run];
}
