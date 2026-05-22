/**
 * Normal Task runtime worker dispatch (default sync path).
 */

import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { isCursorRunSuccessWithResult } from "@/lib/runtime/cursorExecutionJobPersist";
import { confirmCursorGitReflection } from "@/lib/runtime/cursorExecutionReflection";
import { pipelineMessageForCode } from "@/lib/runtime/pipelineResultCodes";
import { runCursorJobSynchronously } from "@/lib/runtime/cursorExecutionJobSync";
import { runPipelineJobSynchronously } from "@/lib/runtime/pipelineExecutionJobSync";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";

export type WorkerDispatchStep = {
  readonly phase: string;
  readonly ok?: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly jobId?: string;
};

export type NormalTaskWorkerDispatchInput = {
  readonly projectId: string;
  readonly taskId: string;
  readonly actorUserId: string;
  readonly execRunId: string;
  readonly singleTaskId?: string;
};

export type NormalTaskWorkerDispatchResult = {
  readonly ok: boolean;
  readonly message: string;
  readonly cursorJobId?: string;
  readonly pipelineJobId?: string;
  readonly cursorOutcome?: ExecuteCursorRunOutcome;
  readonly pipelineCode?: string;
  readonly steps: readonly WorkerDispatchStep[];
};

function pushStep(steps: WorkerDispatchStep[], step: WorkerDispatchStep): void {
  steps.push(step);
}

/** @deprecated Use shouldUseRuntimeWorkerPathForTask — worker path is default for normal tasks. */
export function isNormalTaskWorkerDispatchEnabled(): boolean {
  return shouldUseRuntimeWorkerPathForTask(null);
}

/** Emergency fallback: EXECUTION_LOOP_FORCE_INLINE_CURSOR=1 */
export function isLegacyInlineCursorPathForced(): boolean {
  return process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR === "1";
}

export function shouldUseRuntimeWorkerPathForTask(taskKind: string | null | undefined): boolean {
  if (isEnvTestFamilyTaskKind(taskKind)) return false;
  if (isLegacyInlineCursorPathForced()) return false;
  return true;
}

export async function runNormalTaskViaRuntimeWorkers(
  input: NormalTaskWorkerDispatchInput
): Promise<NormalTaskWorkerDispatchResult> {
  const steps: WorkerDispatchStep[] = [];
  pushStep(steps, { phase: "worker_dispatch", ok: true, message: "runtime_worker_path" });

  const taskRow = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { taskKind: true },
  });
  if (taskRow && isEnvTestFamilyTaskKind(taskRow.taskKind)) {
    pushStep(steps, {
      phase: "worker_dispatch",
      ok: false,
      code: "ENV_TEST_SYNC_ONLY",
      message: "ENV_TEST tasks must use sync runExecutionLoop path",
    });
    return {
      ok: false,
      message: "ENV_TEST tasks must use sync runExecutionLoop path",
      steps,
    };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } })
  );
  if (!setup?.gitRepoUrl?.trim()) {
    pushStep(steps, {
      phase: "worker_dispatch",
      ok: false,
      code: "SETUP_MISSING",
      message: "Execution setup missing",
    });
    return { ok: false, message: "Execution setup missing", steps };
  }

  const cursorPayload = {
    execRunId: input.execRunId,
    taskId: input.taskId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    singleTaskId: input.singleTaskId,
  };

  const cursorRun = await runCursorJobSynchronously({
    ...cursorPayload,
    projectId: input.projectId,
  });

  pushStep(steps, {
    phase: "cursor_job",
    ok: cursorRun.ok,
    code: cursorRun.ok ? "CURSOR_COMPLETED" : "CURSOR_FAILED",
    message: cursorRun.message,
    jobId: cursorRun.jobId,
  });

  if (!cursorRun.ok) {
    await refreshWorkflowStates(input.projectId);
    return {
      ok: false,
      message: cursorRun.message,
      cursorJobId: cursorRun.jobId,
      cursorOutcome: cursorRun.cursorOutcome,
      steps,
    };
  }

  const cursorOutcome = cursorRun.cursorOutcome;
  if (!cursorOutcome || !isCursorRunSuccessWithResult(cursorOutcome)) {
    pushStep(steps, {
      phase: "cursor_job",
      ok: false,
      code: "CURSOR_NO_RESULT",
      message: "Cursor job finished without a successful cursor result",
      jobId: cursorRun.jobId,
    });
    await refreshWorkflowStates(input.projectId);
    return {
      ok: false,
      message: "Cursor job finished without a successful cursor result",
      cursorJobId: cursorRun.jobId,
      cursorOutcome,
      steps,
    };
  }

  const cr = cursorOutcome.result;
  const reflection = await confirmCursorGitReflection({
    execRunId: input.execRunId,
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    repoUrl: setup.gitRepoUrl.trim(),
    baseBranch: setup.baseBranch,
    headBranch: cr.branchName,
    cursorResult: cr,
    githubAccessToken: setup.githubAccessToken ?? null,
    executionJobId: cursorRun.jobId ?? null,
  });

  pushStep(steps, {
    phase: "reflection",
    ok: reflection.confirmed,
    code: reflection.confirmed ? "REFLECTION_CONFIRMED" : "REFLECTION_PENDING",
    message: reflection.reason,
  });

  if (!reflection.confirmed) {
    await refreshWorkflowStates(input.projectId);
    return {
      ok: true,
      message:
        "에이전트는 종료되었지만 Git 반영이 확인되지 않아 pipeline을 시작하지 않았습니다.",
      cursorJobId: cursorRun.jobId,
      cursorOutcome,
      steps,
    };
  }

  const pipelineRun = await runPipelineJobSynchronously({
    projectId: input.projectId,
    execRunId: input.execRunId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    resumeScmAfterApproval: false,
  });

  const pipelineCode = pipelineRun.code ?? pipelineRun.pipelineResult?.code;
  const message = pipelineMessageForCode(pipelineCode, pipelineRun.message);

  pushStep(steps, {
    phase: "pipeline_job",
    ok: pipelineRun.ok,
    code: pipelineCode,
    message: pipelineRun.message,
    jobId: pipelineRun.jobId,
  });
  pushStep(steps, {
    phase: "pipeline_result",
    ok: pipelineRun.ok,
    code: pipelineCode,
    message,
  });

  await refreshWorkflowStates(input.projectId);

  return {
    ok: pipelineRun.ok,
    message,
    cursorJobId: cursorRun.jobId,
    pipelineJobId: pipelineRun.jobId,
    cursorOutcome,
    pipelineCode,
    steps,
  };
}
