import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  advanceQuickRunOrchestrationAfterGithubVerify,
  type QuickRunGithubAdvanceResult,
} from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import {
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import type { TaskCursorGithubVerifyRequestBody } from "@/lib/prototype/taskCursorGithubVerifyTypes";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  verifyTaskCursorGithubResult,
  type TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { prisma } from "@/lib/prisma";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  allowedPathGlobs: true,
  githubAccessToken: true,
} as const;

export type TaskCursorGithubVerifyBlocked = Readonly<{
  readonly kind: "blocked";
  readonly message: string;
  readonly status?: string;
}>;

export type TaskCursorGithubVerifySuccess = Readonly<{
  readonly kind: "ok";
  readonly verify: TaskCursorGithubVerifyResult;
  readonly execution: TaskCursorExecutionV1;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly advance: QuickRunGithubAdvanceResult;
  readonly continuationDispatchedOnServer?: boolean;
}>;

export type TaskCursorGithubVerifyOutcome = TaskCursorGithubVerifyBlocked | TaskCursorGithubVerifySuccess;

export function validateTaskCursorGithubVerifyExecution(
  execution: TaskCursorExecutionV1,
): TaskCursorGithubVerifyBlocked | null {
  if (execution.status === "cursor_requested") {
    return {
      kind: "blocked",
      status: "blocked",
      message:
        "Cursor 실행 요청이 아직 처리 중입니다. 잠시 후 다시 시도하거나 상단 툴바에서 실행 상태를 확인해 주세요.",
    };
  }
  const needsBranch =
    execution.status === "cursor_running" ||
    execution.status === "cursor_failed" ||
    execution.status === "github_verify_failed";
  if (needsBranch && !String(execution.workBranch ?? "").trim()) {
    return {
      kind: "blocked",
      status: "blocked",
      message:
        execution.status === "cursor_running"
          ? "WIP branch가 없어 GitHub commit 확인을 할 수 없습니다. Cursor 실행이 완료된 뒤 다시 시도해 주세요."
          : "WIP branch가 없어 GitHub commit 확인을 할 수 없습니다.",
    };
  }
  return null;
}

export async function runTaskCursorGithubVerifyWithQuickRunAdvance(input: {
  readonly projectId: string;
  readonly body: TaskCursorGithubVerifyRequestBody;
  readonly execution: TaskCursorExecutionV1;
}): Promise<TaskCursorGithubVerifyOutcome> {
  const projectId = input.projectId.trim();
  const body = input.body;
  const execution = input.execution;
  const blocked = validateTaskCursorGithubVerifyExecution(execution);
  if (blocked) return blocked;

  const setupRow = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: EXECUTION_SETUP_SELECT,
  });
  const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
  const readiness = evaluateTaskCursorGithubVerifyReadiness({ setup });
  if (!readiness.ok) {
    return { kind: "blocked", status: "blocked", message: readiness.message };
  }

  const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return {
      kind: "blocked",
      status: "blocked",
      message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
    };
  }

  const nowIso = new Date().toISOString();
  let nextExecution = patchTaskCursorExecution(execution, {
    status: "github_verifying",
    githubProgressLastCheckAt: nowIso,
    nowIso,
  });
  const timeline = [
    buildTaskCursorTimelineEntry({
      action: "task_cursor_github_verify_requested",
      projectId,
      taskId: nextExecution.taskId,
      status: "github_verifying",
      targetRepository: nextExecution.targetRepository,
      baseBranch: nextExecution.baseBranch,
      workBranch: nextExecution.workBranch,
      commitSha: nextExecution.commitSha,
      runId: nextExecution.cursorRunId,
      nowIso,
    }),
  ];

  const verify = await verifyTaskCursorGithubResult({
    execution: nextExecution,
    targetRepository: readiness.targetRepository,
    githubToken,
    allowedPathGlobs: readiness.allowedPathGlobs,
    codeTaskId: String(body.codeTaskId ?? "").trim() || null,
  });

  nextExecution = applyTaskCursorGithubVerifyResult({
    execution: nextExecution,
    ok: verify.ok,
    message: verify.message,
    reason: verify.reason,
    detailReason: verify.detailReason,
    verifiedChangedFiles: verify.verifiedChangedFiles,
    verifiedCommitSha: verify.verifiedCommitSha,
    nowIso,
  });
  if (nextExecution.status === "github_verified") {
    nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
  }
  timeline.push(
    buildTaskCursorGithubVerifyTimeline({
      execution: nextExecution,
      ok: verify.ok,
      reason: verify.reason,
      nowIso,
    }),
  );

  const dbBundle = await getImplementationRuntimeBundle(projectId);
  const codeTaskId =
    String(body.codeTaskId ?? "").trim() ||
    dbBundle.currentRun?.codeTaskId?.trim() ||
    dbBundle.job?.currentCodeTaskId?.trim() ||
    "";

  const workItems = body.workItems ?? [];
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(body.implementationCodeTaskPlanV1);
  const taskList = parseImplementationTaskListV1(body.implementationTaskListV1);
  const dispatchTarget = codeTaskId
    ? resolveCodeTaskDispatchTarget({
        codeTaskId,
        codeTaskPlan,
        taskList,
        cursorWorkItems: workItems,
      })
    : null;

  const basePatch = buildTaskCursorOrchestrationPatch({
    execution: nextExecution,
    timelineEntries: timeline,
    cursorWorkItems: workItems,
    codeTaskExecutionRunsV1: body.codeTaskExecutionRunsV1,
    activeCodeTaskId: (dispatchTarget?.codeTask.codeTaskId ?? codeTaskId) || null,
    activeWorkItemId: dispatchTarget?.workItem.id ?? null,
    ...(parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1)
      ? {
          executionState: parseImplementationTaskExecutionStateV1(
            body.implementationTaskExecutionStateV1,
          ),
        }
      : {}),
  });

  await syncImplementationRuntimeFromTaskCursor({
    projectId,
    codeTaskId: codeTaskId || undefined,
    taskId: nextExecution.taskId,
    execution: nextExecution,
    githubVerifyResult: verify,
  });

  const dbBundleAfter = await getImplementationRuntimeBundle(projectId);

  const advance = advanceQuickRunOrchestrationAfterGithubVerify({
    projectId,
    githubVerifyOk: verify.ok,
    basePatch,
    quickRun: body.implementationQuickRunV1,
    implementationTaskListV1: body.implementationTaskListV1,
    implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1,
    codeTaskExecutionRunsV1: body.codeTaskExecutionRunsV1,
    implementationTaskExecutionStateV1: body.implementationTaskExecutionStateV1,
    implementationQualityGateResultsV1: body.implementationQualityGateResultsV1,
    implementationAutoQualityGateV1: body.implementationAutoQualityGateV1,
    implementationAutoQualityGateHistoryV1: body.implementationAutoQualityGateHistoryV1,
    cursorWorkItemsV1: workItems,
    promptTimeline: body.promptTimeline,
    dbBundle: dbBundleAfter,
    nowIso,
  });

  let orchestrationPatch = advance.orchestrationPatch;
  const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
  let continuationDispatchedOnServer = false;

  const execReadiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup,
    env: process.env as Record<string, string | undefined>,
  });

  if (verify.ok && advance.nextDispatch && cursorApiToken && execReadiness.ok) {
    const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
      projectId,
      dispatch: advance.nextDispatch,
      baseOrchestrationPatch: orchestrationPatch,
      requirementsSlice: mergeRequirementsStateJson(
        {
          promptTimeline: body.promptTimeline ?? [],
          implementationQuickRunV1: body.implementationQuickRunV1,
          implementationTaskListV1: body.implementationTaskListV1,
          implementationCodeTaskPlanV1: body.implementationCodeTaskPlanV1,
          codeTaskExecutionRunsV1: body.codeTaskExecutionRunsV1,
          cursorWorkItemsV1: workItems,
          taskCursorExecutionV1: nextExecution,
        },
        orchestrationPatch as Record<string, unknown>,
      ),
      context: execReadiness.context,
      cursorApiToken,
      nowIso,
    });
    orchestrationPatch = dispatchOutcome.orchestrationPatch;
    continuationDispatchedOnServer = dispatchOutcome.dispatched;
  }

  return {
    kind: "ok",
    verify,
    execution: nextExecution,
    orchestrationPatch,
    advance: { ...advance, orchestrationPatch },
    continuationDispatchedOnServer,
  };
}
