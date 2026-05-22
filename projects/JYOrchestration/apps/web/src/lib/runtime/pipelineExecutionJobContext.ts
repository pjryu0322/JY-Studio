/**
 * Pipeline execution job — phase context resolution.
 */

import type { ExecutionJob } from "@prisma/client";
import { isEnvTestFamilyTaskKind } from "@/lib/execution/envTestTaskKind";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import type { PipelineExecutionJobPayload } from "@/lib/runtime/pipelineExecutionJobTypes";
import type { PipelinePhaseContext } from "@/lib/runtime/pipelineExecutionPhaseTypes";
import type { ExecutionWorkerStructuredResult } from "@/lib/runtime/executionWorkerStructuredResult";

export async function resolvePipelinePhaseContext(
  job: ExecutionJob,
  payload: PipelineExecutionJobPayload
): Promise<ExecutionWorkerStructuredResult | PipelinePhaseContext> {
  const taskRow = await prisma.task.findUnique({
    where: { id: payload.taskId },
    select: {
      id: true,
      name: true,
      description: true,
      acceptanceCriteria: true,
      taskKind: true,
    },
  });
  if (!taskRow) {
    return { ok: false, code: "TASK_NOT_FOUND", message: "Task not found" };
  }

  if (isEnvTestFamilyTaskKind(taskRow.taskKind)) {
    return {
      ok: false,
      code: "ENV_TEST_REQUIRES_SYNC_LOOP",
      message: "ENV_TEST pipeline phases must run via runExecutionLoop sync orchestrator.",
    };
  }

  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: payload.projectId } })
  );
  if (!setup?.gitRepoUrl?.trim()) {
    return { ok: false, code: "SETUP_MISSING", message: "Execution setup missing" };
  }

  return {
    projectId: payload.projectId,
    taskId: payload.taskId,
    actorUserId: payload.actorUserId,
    execRunId: payload.execRunId,
    executionJobId: job.id,
    repoUrl: setup.gitRepoUrl.trim(),
    baseBranch: setup.baseBranch,
    githubAccessToken: setup.githubAccessToken ?? null,
    requireApprovalBeforeApply: setup.requireApprovalBeforeApply === true,
    mergedAllowedGlobs: parseStringArrayJson(setup.allowedPathGlobs),
    stopOnTestFailure: setup.stopOnTestFailure !== false,
    stopOnOutOfScopeChange: setup.stopOnOutOfScopeChange !== false,
    taskTitle: taskRow.name,
    taskDescription: taskRow.description,
    acceptanceCriteriaJson: taskRow.acceptanceCriteria,
  };
}

export function isPipelinePhaseContext(
  value: ExecutionWorkerStructuredResult | PipelinePhaseContext
): value is PipelinePhaseContext {
  return "execRunId" in value && "repoUrl" in value;
}
