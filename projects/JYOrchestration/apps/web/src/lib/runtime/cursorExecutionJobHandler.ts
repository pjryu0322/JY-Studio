/**
 * Cursor execution job worker handler (ExecutionRun-centric).
 */

import type { ExecutionJob, Prisma } from "@prisma/client";
import {
  executeCursorRun,
  type ExecuteCursorRunOutcome,
} from "@/lib/execution/cursorExecutionAdapter";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import { computeExecutionBranchPlan } from "@/lib/execution/branchPolicy";
import { isEnvTestFamilyTaskKind, isEnvTestStage2TaskKind } from "@/lib/execution/envTestTaskKind";
import { runEnvTestCursorToPrOpenedCore } from "@/lib/executionLoop/envTestExecutionCore";
import { parseCriteria, parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import {
  type CursorExecutionJobPayload,
  type CursorExecutionJobResult,
  parseCursorExecutionJobPayload,
} from "@/lib/runtime/cursorExecutionJobTypes";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";

type StructuredJobResult = {
  ok: boolean;
  code: string;
  message: string;
  data?: unknown;
};

function isCursorRunSuccessWithResult(
  o: ExecuteCursorRunOutcome
): o is { ok: true; result: CursorRunResult; logs: string[] } {
  return Boolean(o.ok && "result" in o);
}

async function persistCursorSuccess(execRunId: string, outcome: ExecuteCursorRunOutcome): Promise<void> {
  if (!isCursorRunSuccessWithResult(outcome)) return;
  const cr = outcome.result;
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      status: "awaiting_git_reflection",
      runError: null,
      changedFiles: cr.changedFiles?.length
        ? (cr.changedFiles as Prisma.InputJsonValue)
        : undefined,
      commitSha: cr.commitHash ?? null,
      pushStatus: cr.prUrl ? "pr_reported_by_cursor" : "delegated_to_cursor",
      prStatus: cr.prUrl ? `pr:${cr.prUrl}`.slice(0, 500) : undefined,
    },
  });
}

async function persistCursorFailure(execRunId: string, message: string): Promise<void> {
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      status: "failed",
      runError: message.slice(0, 8000),
      evaluationDecision: "failed",
      evaluationReason: `cursor_worker:${message}`.slice(0, 2000),
    },
  });
}

export async function handleCursorExecutionJob(job: ExecutionJob): Promise<StructuredJobResult> {
  const payload = parseCursorExecutionJobPayload(job.payload);
  if (!payload) {
    return {
      ok: false,
      code: "INVALID_CURSOR_PAYLOAD",
      message: "Cursor job payload must include execRunId, taskId, projectId, actorUserId",
    };
  }

  if (payload.projectId !== job.projectId) {
    return { ok: false, code: "PROJECT_MISMATCH", message: "Job projectId does not match payload" };
  }

  await appendRuntimeEvent({
    eventType: "CURSOR_STARTED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "cursor",
    executionJobId: job.id,
    runtimeState: "running",
  });

  const execRun = await prisma.taskExecutionRun.findFirst({
    where: { id: payload.execRunId, projectId: payload.projectId, taskId: payload.taskId },
  });
  if (!execRun) {
    return { ok: false, code: "EXEC_RUN_NOT_FOUND", message: "TaskExecutionRun not found for cursor job" };
  }

  const taskRow = await prisma.task.findUnique({
    where: { id: payload.taskId },
    select: {
      id: true,
      name: true,
      description: true,
      acceptanceCriteria: true,
      sourceSpecVersionId: true,
      taskKind: true,
    },
  });
  if (!taskRow) {
    return { ok: false, code: "TASK_NOT_FOUND", message: "Task not found" };
  }

  if (isEnvTestStage2TaskKind(taskRow.taskKind)) {
    return {
      ok: false,
      code: "STAGE2_REQUIRES_SYNC_LOOP",
      message:
        "ENV_TEST_STAGE2 must run via runExecutionLoop sync orchestrator (GitHub source-of-truth pipeline).",
    };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: payload.projectId } })
  );
  if (!setup?.gitRepoUrl?.trim()) {
    return { ok: false, code: "SETUP_MISSING", message: "Execution setup or git repo missing" };
  }

  const project = await prisma.project.findUnique({
    where: { id: payload.projectId },
    select: { name: true },
  });

  const criteria = parseCriteria(taskRow.acceptanceCriteria);
  const allowedGlobs = parseStringArrayJson(setup.allowedPathGlobs);
  const branchPlan = computeExecutionBranchPlan({
    branchStrategy: setup.branchStrategy,
    branchPrefix: setup.branchPrefix,
    projectId: payload.projectId,
    taskId: taskRow.id,
    taskTitle: taskRow.name,
    baseBranch: setup.baseBranch,
    taskKind: taskRow.taskKind,
  });

  const prompt =
    execRun.promptSnapshot?.trim() ||
    buildCursorExecutionPrompt(
      {
        id: taskRow.id,
        title: taskRow.name,
        description: taskRow.description,
        acceptanceCriteria: criteria,
      },
      { id: payload.projectId, name: project?.name ?? payload.projectId },
      {
        gitRepoUrl: setup.gitRepoUrl.trim(),
        baseBranch: setup.baseBranch,
        branchStrategy: setup.branchStrategy,
        suggestedBranchName: branchPlan.branchName,
        autoCommit: setup.autoCommit !== false,
        autoPush: setup.autoPush === true,
        requireTestsBeforePush: setup.requireTestsBeforePush !== false,
        allowedPathGlobs: allowedGlobs,
      },
      isEnvTestFamilyTaskKind(taskRow.taskKind)
        ? { compactHelloWorld: true, envTestCompactVariant: "stage1" }
        : undefined
    );

  const isEnvTestTask = isEnvTestFamilyTaskKind(taskRow.taskKind);
  const repoUrl = setup.gitRepoUrl.trim();

  const executeParams = {
    projectId: payload.projectId,
    workflowId: taskRow.sourceSpecVersionId ?? null,
    executionSetup: {
      cursorApiUrl: normalizeCursorApiBaseUrl(setup.cursorApiUrl),
      cursorApiToken: setup.cursorApiToken ?? null,
      gitRepoUrl: repoUrl,
      baseBranch: setup.baseBranch,
      branchStrategy: setup.branchStrategy,
      branchPrefix: setup.branchPrefix,
      autoCommit: setup.autoCommit !== false,
      autoPush: setup.autoPush === true,
      autoPr: false,
      requireTestsBeforePush: setup.requireTestsBeforePush !== false,
    },
    task: {
      id: taskRow.id,
      title: taskRow.name,
      description: taskRow.description,
      acceptanceCriteria: criteria,
    },
    suggestedBranchName: branchPlan.branchName,
    prompt,
    allowedPaths: allowedGlobs.length ? allowedGlobs : undefined,
    taskKind: taskRow.taskKind ?? null,
    githubAccessToken: setup.githubAccessToken ?? null,
    envTestPollFinalizeContext: isEnvTestTask
      ? {
          execRunId: payload.execRunId,
          actorUserId: payload.actorUserId,
          taskId: payload.taskId,
          repoUrl,
          baseBranch: setup.baseBranch,
          githubAccessToken: setup.githubAccessToken ?? null,
          steps: [],
          singleTaskId: payload.singleTaskId,
          effectiveAutoAdvance: false,
          execRunCreatedAt: execRun.createdAt,
        }
      : undefined,
  };

  let cursorOutcome: ExecuteCursorRunOutcome;
  try {
    cursorOutcome = isEnvTestTask
      ? await runEnvTestCursorToPrOpenedCore({
          executeParams,
          ctx: {
            projectId: payload.projectId,
            taskId: payload.taskId,
            actorUserId: payload.actorUserId,
            execRunId: payload.execRunId,
            branchName: branchPlan.branchName,
          },
        })
      : await executeCursorRun(executeParams);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await persistCursorFailure(payload.execRunId, msg);
    await appendRuntimeEvent({
      eventType: "CURSOR_FAILED",
      severity: "error",
      projectId: payload.projectId,
      taskId: payload.taskId,
      execRunId: payload.execRunId,
      actorUserId: payload.actorUserId,
      workerName: "cursor",
      failurePhase: "EXECUTE",
      executionJobId: job.id,
      runtimeState: "failed",
      detail: { error: msg },
    });
    return { ok: false, code: "CURSOR_RUNTIME_ERROR", message: msg };
  }

  if (!cursorOutcome.ok) {
    const msg = cursorOutcome.error ?? "cursor failed";
    await persistCursorFailure(payload.execRunId, msg);
    await appendRuntimeEvent({
      eventType: "CURSOR_FAILED",
      severity: "error",
      projectId: payload.projectId,
      taskId: payload.taskId,
      execRunId: payload.execRunId,
      actorUserId: payload.actorUserId,
      workerName: "cursor",
      failurePhase: "EXECUTE",
      executionJobId: job.id,
      runtimeState: "failed",
      detail: { error: msg },
    });
    const result: CursorExecutionJobResult = {
      ok: false,
      code: "CURSOR_FAILED",
      message: msg,
      cursorOutcome,
    };
    return { ok: false, code: result.code, message: result.message, data: result };
  }

  await persistCursorSuccess(payload.execRunId, cursorOutcome);

  await appendRuntimeEvent({
    eventType: "CURSOR_COMPLETED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "cursor",
    executionJobId: job.id,
    runtimeState: "awaiting_git_reflection",
    detail: {
      runId: isCursorRunSuccessWithResult(cursorOutcome) ? cursorOutcome.result.runId : null,
    },
  });

  const result: CursorExecutionJobResult = {
    ok: true,
    code: "CURSOR_COMPLETED",
    message: "Cursor execution completed",
    cursorOutcome,
  };
  return { ok: true, code: result.code, message: result.message, data: result };
}

/** Enqueue + synchronous process helper for runExecutionLoop (non–Stage-2 ENV_TEST). */
export async function runCursorJobSynchronously(input: CursorExecutionJobPayload & { projectId: string }): Promise<{
  ok: boolean;
  cursorOutcome?: ExecuteCursorRunOutcome;
  message: string;
  jobId?: string;
}> {
  const { enqueueExecution } = await import("@/lib/service/executionQueue");
  const { processExecutionJobById } = await import("@/lib/service/executionWorker");

  const enq = await enqueueExecution({
    projectId: input.projectId,
    type: "cursor",
    payload: input as unknown as import("@prisma/client").Prisma.InputJsonValue,
  });
  if (!enq.queued) {
    return { ok: false, message: enq.reason };
  }

  await processExecutionJobById(enq.jobId);
  const job = await prisma.executionJob.findUnique({ where: { id: enq.jobId }, select: { status: true, result: true, error: true } });
  if (!job) {
    return { ok: false, message: "Cursor job row missing after process" };
  }
  if (job.status !== "DONE") {
    return { ok: false, message: job.error ?? "Cursor job failed", jobId: enq.jobId };
  }
  const data = job.result as { data?: CursorExecutionJobResult } | null;
  const cursorOutcome = data?.data?.cursorOutcome;
  return { ok: true, cursorOutcome, message: "ok", jobId: enq.jobId };
}
