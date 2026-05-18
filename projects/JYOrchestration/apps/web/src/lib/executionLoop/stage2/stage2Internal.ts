/**
 * Stage2-only internals: failure paths and structured sub-phase logs.
 * Does not import Stage1 helpers or Stage1 retry configuration.
 */
import { prisma } from "@/lib/prisma";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { mergeEnvTestStage2RunValidationOutput } from "@/lib/service/envTestStage2PlatformActors";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export async function failEnvTestStage2WithCode(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  code: "NO_COMMIT" | "BRANCH_NOT_REFLECTED" | "PR_NOT_OPENED";
  summaryKo: string;
}): Promise<void> {
  const rowVo = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const vo = mergeEnvTestStage2RunValidationOutput(rowVo?.validationOutput, {
    stage2RunSummary: {
      finalOutcome: "FAILED",
      mergeVerified: false,
    },
  });
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      status: "failed",
      evaluationDecision: "failed",
      evaluationReason: input.code,
      validationOutput: vo,
    },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: "FAILED",
      executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
      lastEvalResult: input.code,
      lastEvalSummary: input.summaryKo,
    },
  });
  await refreshWorkflowStates(input.projectId);
}

export function hasStage2CommitEvidence(input: {
  commitHash?: string | null | undefined;
  headShaHint?: string | null | undefined;
  changedFiles?: string[] | null | undefined;
}): boolean {
  const commitOk = Boolean(String(input.commitHash ?? "").trim());
  const headHintOk = Boolean(String(input.headShaHint ?? "").trim());
  const filesOk = Array.isArray(input.changedFiles) && input.changedFiles.length > 0;
  return commitOk || headHintOk || filesOk;
}

export function logStage2CommitCheck(
  phase: "stage2_commit_check_started" | "stage2_commit_check_passed" | "stage2_commit_check_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}

export function logStage2BranchReflectionCheck(
  phase:
    | "stage2_branch_reflection_started"
    | "stage2_branch_reflection_passed"
    | "stage2_branch_reflection_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}

export function logStage2PrCreationCheck(
  phase: "stage2_pr_creation_started" | "stage2_pr_creation_passed" | "stage2_pr_creation_failed",
  ctx: { projectId: string; taskId: string; actorUserId: string; detail?: Record<string, unknown> }
): void {
  appendTaskProgressLog({
    kind: "execution",
    phase,
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: ctx.detail ?? {},
  });
}
