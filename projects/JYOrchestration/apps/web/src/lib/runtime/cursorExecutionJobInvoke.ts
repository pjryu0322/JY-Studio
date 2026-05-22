/**
 * Cursor execution job — invoke and ExecutionRun context load.
 */

import type { ExecuteCursorRelayParams, ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { executeCursorRun } from "@/lib/execution/cursorExecutionAdapter";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import { computeExecutionBranchPlan } from "@/lib/execution/branchPolicy";
import { isEnvTestFamilyTaskKind, isEnvTestStage2TaskKind } from "@/lib/execution/envTestTaskKind";
import { runEnvTestCursorToPrOpenedCore } from "@/lib/executionLoop/envTestExecutionCore";
import { parseCriteria, parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import type { CursorExecutionJobPayload } from "@/lib/runtime/cursorExecutionJobTypes";
import type { ExecutionWorkerStructuredResult } from "@/lib/runtime/executionWorkerStructuredResult";

export type CursorExecutionInvokeContext = {
  readonly payload: CursorExecutionJobPayload;
  readonly executionJobId: string;
  readonly execRun: {
    readonly id: string;
    readonly promptSnapshot: string | null;
    readonly createdAt: Date;
  };
  readonly taskRow: {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly acceptanceCriteria: unknown;
    readonly sourceSpecVersionId: string | null;
    readonly taskKind: string | null;
  };
  readonly setup: {
    readonly gitRepoUrl: string;
    readonly baseBranch: string;
    readonly branchStrategy: string;
    readonly branchPrefix: string | null;
    readonly autoCommit: boolean;
    readonly autoPush: boolean;
    readonly requireTestsBeforePush: boolean;
    readonly cursorApiUrl: string | null;
    readonly cursorApiToken: string | null;
    readonly githubAccessToken: string | null;
    readonly allowedPathGlobs: unknown;
  };
  readonly branchName: string;
  readonly prompt: string;
  readonly isEnvTestTask: boolean;
};

export async function loadCursorExecutionInvokeContext(
  payload: CursorExecutionJobPayload,
  executionJobId: string
): Promise<ExecutionWorkerStructuredResult | CursorExecutionInvokeContext> {
  const execRun = await prisma.taskExecutionRun.findFirst({
    where: { id: payload.execRunId, projectId: payload.projectId, taskId: payload.taskId },
    select: { id: true, promptSnapshot: true, createdAt: true },
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

  const setupRow = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: payload.projectId } })
  );
  if (!setupRow?.gitRepoUrl?.trim()) {
    return { ok: false, code: "SETUP_MISSING", message: "Execution setup or git repo missing" };
  }

  const project = await prisma.project.findUnique({
    where: { id: payload.projectId },
    select: { name: true },
  });

  const criteria = parseCriteria(taskRow.acceptanceCriteria);
  const allowedGlobs = parseStringArrayJson(setupRow.allowedPathGlobs);
  const branchPlan = computeExecutionBranchPlan({
    branchStrategy: setupRow.branchStrategy,
    branchPrefix: setupRow.branchPrefix,
    projectId: payload.projectId,
    projectName: project?.name ?? null,
    taskId: taskRow.id,
    taskTitle: taskRow.name,
    baseBranch: setupRow.baseBranch,
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
        gitRepoUrl: setupRow.gitRepoUrl.trim(),
        baseBranch: setupRow.baseBranch,
        branchStrategy: setupRow.branchStrategy,
        suggestedBranchName: branchPlan.branchName,
        autoCommit: setupRow.autoCommit !== false,
        autoPush: setupRow.autoPush === true,
        requireTestsBeforePush: setupRow.requireTestsBeforePush !== false,
        allowedPathGlobs: allowedGlobs,
      },
      isEnvTestFamilyTaskKind(taskRow.taskKind)
        ? { compactHelloWorld: true, envTestCompactVariant: "stage1" }
        : undefined
    );

  return {
    payload,
    executionJobId,
    execRun,
    taskRow,
    setup: {
      gitRepoUrl: setupRow.gitRepoUrl.trim(),
      baseBranch: setupRow.baseBranch,
      branchStrategy: setupRow.branchStrategy,
      branchPrefix: setupRow.branchPrefix,
      autoCommit: setupRow.autoCommit !== false,
      autoPush: setupRow.autoPush === true,
      requireTestsBeforePush: setupRow.requireTestsBeforePush !== false,
      cursorApiUrl: setupRow.cursorApiUrl,
      cursorApiToken: setupRow.cursorApiToken,
      githubAccessToken: setupRow.githubAccessToken,
      allowedPathGlobs: setupRow.allowedPathGlobs,
    },
    branchName: branchPlan.branchName,
    prompt,
    isEnvTestTask: isEnvTestFamilyTaskKind(taskRow.taskKind),
  };
}

export function buildCursorExecuteParams(ctx: CursorExecutionInvokeContext): ExecuteCursorRelayParams {
  const allowedGlobs = parseStringArrayJson(ctx.setup.allowedPathGlobs);
  const criteria = parseCriteria(ctx.taskRow.acceptanceCriteria);
  const repoUrl = ctx.setup.gitRepoUrl;

  return {
    projectId: ctx.payload.projectId,
    workflowId: ctx.taskRow.sourceSpecVersionId ?? null,
    executionSetup: {
      cursorApiUrl: normalizeCursorApiBaseUrl(ctx.setup.cursorApiUrl),
      cursorApiToken: ctx.setup.cursorApiToken ?? null,
      gitRepoUrl: repoUrl,
      baseBranch: ctx.setup.baseBranch,
      branchStrategy: ctx.setup.branchStrategy,
      branchPrefix: ctx.setup.branchPrefix,
      autoCommit: ctx.setup.autoCommit,
      autoPush: ctx.setup.autoPush,
      autoPr: false,
      requireTestsBeforePush: ctx.setup.requireTestsBeforePush,
    },
    task: {
      id: ctx.taskRow.id,
      title: ctx.taskRow.name,
      description: ctx.taskRow.description,
      acceptanceCriteria: criteria,
    },
    suggestedBranchName: ctx.branchName,
    prompt: ctx.prompt,
    allowedPaths: allowedGlobs.length ? allowedGlobs : undefined,
    taskKind: ctx.taskRow.taskKind ?? null,
    githubAccessToken: ctx.setup.githubAccessToken ?? null,
    envTestPollFinalizeContext: ctx.isEnvTestTask
      ? {
          execRunId: ctx.payload.execRunId,
          actorUserId: ctx.payload.actorUserId,
          taskId: ctx.payload.taskId,
          repoUrl,
          baseBranch: ctx.setup.baseBranch,
          githubAccessToken: ctx.setup.githubAccessToken ?? null,
          steps: [],
          singleTaskId: ctx.payload.singleTaskId,
          effectiveAutoAdvance: false,
          execRunCreatedAt: ctx.execRun.createdAt,
        }
      : undefined,
  };
}

export async function invokeCursorExecution(ctx: CursorExecutionInvokeContext): Promise<ExecuteCursorRunOutcome> {
  const executeParams = buildCursorExecuteParams(ctx);
  if (ctx.isEnvTestTask) {
    return runEnvTestCursorToPrOpenedCore({
      executeParams,
      ctx: {
        projectId: ctx.payload.projectId,
        taskId: ctx.payload.taskId,
        actorUserId: ctx.payload.actorUserId,
        execRunId: ctx.payload.execRunId,
        branchName: ctx.branchName,
      },
    });
  }
  return executeCursorRun(executeParams);
}

export function isCursorInvokeContext(
  value: ExecutionWorkerStructuredResult | CursorExecutionInvokeContext
): value is CursorExecutionInvokeContext {
  return "execRun" in value && "taskRow" in value;
}
