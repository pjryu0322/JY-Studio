/**
 * Self-healing AUTO_HEALING task — dedicated TaskExecutionRun creation.
 */

import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import { computeExecutionBranchPlan } from "@/lib/execution/branchPolicy";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import { parseCriteria } from "@/lib/executionLoop/loopJsonUtils";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

export type CreateSelfHealingExecutionRunInput = {
  readonly projectId: string;
  readonly healingTaskId: string;
  readonly actorUserId: string;
  readonly sourceExecRunId: string;
  readonly sourceTaskId: string;
};

export async function createSelfHealingExecutionRun(
  input: CreateSelfHealingExecutionRunInput
): Promise<{ execRunId: string; promptSnapshot: string }> {
  const sourceRun = await prisma.taskExecutionRun.findFirst({
    where: { id: input.sourceExecRunId, projectId: input.projectId },
    select: { branchName: true, repoUrlSnapshot: true },
  });

  const taskRow = await prisma.task.findUnique({
    where: { id: input.healingTaskId },
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
    throw new Error(`Healing task not found: ${input.healingTaskId}`);
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true },
  });

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } })
  );
  const repoUrl = setup?.gitRepoUrl?.trim() ?? sourceRun?.repoUrlSnapshot ?? "";
  const criteria = parseCriteria(taskRow.acceptanceCriteria);

  const branchPlan = computeExecutionBranchPlan({
    branchStrategy: setup?.branchStrategy ?? "per_task",
    branchPrefix: setup?.branchPrefix ?? null,
    projectId: input.projectId,
    taskId: taskRow.id,
    taskTitle: taskRow.name,
    baseBranch: setup?.baseBranch ?? "main",
    taskKind: taskRow.taskKind,
  });

  const prompt = buildCursorExecutionPrompt(
    {
      id: taskRow.id,
      title: taskRow.name,
      description: taskRow.description,
      acceptanceCriteria: criteria,
    },
    { id: input.projectId, name: projectRow?.name ?? "Project" },
    {
      gitRepoUrl: repoUrl,
      baseBranch: setup?.baseBranch ?? "main",
      branchStrategy: setup?.branchStrategy ?? "per_task",
      suggestedBranchName: branchPlan.branchName,
      autoCommit: setup?.autoCommit !== false,
      autoPush: setup?.autoPush === true,
      requireTestsBeforePush: setup?.requireTestsBeforePush !== false,
      allowedPathGlobs: [],
    }
  );

  const run = await prisma.taskExecutionRun.create({
    data: {
      projectId: input.projectId,
      taskId: input.healingTaskId,
      status: "running",
      teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.REQUESTED,
      branchName: branchPlan.branchName,
      promptSnapshot: prompt,
      retryCount: 0,
      workflowId: taskRow.sourceSpecVersionId ?? null,
      provider: "cursor",
      repoUrlSnapshot: repoUrl || null,
    },
    select: { id: true },
  });

  await appendRuntimeEvent({
    eventType: "SELF_HEALING_EXEC_RUN_CREATED",
    projectId: input.projectId,
    taskId: input.healingTaskId,
    execRunId: run.id,
    actorUserId: input.actorUserId,
    workerName: "self-healing",
    detail: {
      sourceExecRunId: input.sourceExecRunId,
      sourceTaskId: input.sourceTaskId,
      healingTaskId: input.healingTaskId,
      sourceBranchName: sourceRun?.branchName ?? null,
      healingBranchName: branchPlan.branchName,
    },
  });

  return { execRunId: run.id, promptSnapshot: prompt };
}
