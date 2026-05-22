/**
 * Normal Task runtime worker dispatch (feature-flagged sync path).
 */

import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { isCursorRunSuccessWithResult } from "@/lib/runtime/cursorExecutionJobPersist";
import { confirmCursorGitReflection } from "@/lib/runtime/cursorExecutionReflection";
import { runCursorJobSynchronously } from "@/lib/runtime/cursorExecutionJobSync";
import { runPipelineJobSynchronously } from "@/lib/runtime/pipelineExecutionJobSync";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";

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
};

/** Feature flag: EXECUTION_LOOP_CURSOR_VIA_JOB=1 */
export function isNormalTaskWorkerDispatchEnabled(): boolean {
  return process.env.EXECUTION_LOOP_CURSOR_VIA_JOB === "1";
}

export function shouldUseRuntimeWorkerPathForTask(taskKind: string | null | undefined): boolean {
  return !isEnvTestFamilyTaskKind(taskKind) && isNormalTaskWorkerDispatchEnabled();
}

function pipelineMessageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    case "APPROVAL_WAITING":
      return "사용자 승인 대기";
    case "MERGED":
      return "병합 완료";
    case "MERGE_PENDING":
      return "PR/merge 대기";
    case "REVIEW_REJECTED":
      return "검토 반려";
    case "SECURITY_FAILED":
      return "보안 점검 실패";
    case "SCM_HOLD":
      return "SCM 보류";
    default:
      return fallback;
  }
}

export async function runNormalTaskViaRuntimeWorkers(
  input: NormalTaskWorkerDispatchInput
): Promise<NormalTaskWorkerDispatchResult> {
  const taskRow = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { taskKind: true },
  });
  if (taskRow && isEnvTestFamilyTaskKind(taskRow.taskKind)) {
    return {
      ok: false,
      message: "ENV_TEST tasks must use sync runExecutionLoop path",
    };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } })
  );
  if (!setup?.gitRepoUrl?.trim()) {
    return { ok: false, message: "Execution setup missing" };
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

  if (!cursorRun.ok) {
    await refreshWorkflowStates(input.projectId);
    return {
      ok: false,
      message: cursorRun.message,
      cursorJobId: cursorRun.jobId,
      cursorOutcome: cursorRun.cursorOutcome,
    };
  }

  const cursorOutcome = cursorRun.cursorOutcome;
  if (!cursorOutcome || !isCursorRunSuccessWithResult(cursorOutcome)) {
    await refreshWorkflowStates(input.projectId);
    return {
      ok: false,
      message: "Cursor job finished without a successful cursor result",
      cursorJobId: cursorRun.jobId,
      cursorOutcome,
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

  if (!reflection.confirmed) {
    await refreshWorkflowStates(input.projectId);
    return {
      ok: true,
      message:
        "에이전트는 종료되었지만 Git 반영이 확인되지 않아 pipeline을 시작하지 않았습니다.",
      cursorJobId: cursorRun.jobId,
      cursorOutcome,
    };
  }

  const pipelineRun = await runPipelineJobSynchronously({
    projectId: input.projectId,
    execRunId: input.execRunId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    resumeScmAfterApproval: false,
  });

  await refreshWorkflowStates(input.projectId);

  const pipelineCode = pipelineRun.code ?? pipelineRun.pipelineResult?.code;
  const message = pipelineMessageForCode(pipelineCode, pipelineRun.message);

  return {
    ok: pipelineRun.ok,
    message,
    cursorJobId: cursorRun.jobId,
    pipelineJobId: pipelineRun.jobId,
    cursorOutcome,
    pipelineCode,
  };
}
